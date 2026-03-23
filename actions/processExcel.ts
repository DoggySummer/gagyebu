"use server";

import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  LEDGER_USER_GILWOONG,
  requireLedgerUserId,
} from "@/lib/ledgerUser";
import { revalidatePath } from "next/cache";

const BATCH_SIZE = 20;

// Claude 역할: 날짜 변환 + 카테고리 분류 + 포맷 정규화만 담당
// 거래 행 필터링은 코드에서 처리 (환각 방지)
const CLAUDE_PROMPT = `
아래는 한국 신용카드 실제 거래 행 데이터야. 헤더/소계/합계 행은 이미 제거됐어.
각 행은 탭으로 구분되어 있어.

[날짜 변환 - 반드시 적용]
- "YY.MM.DD" / "YY/MM/DD" / "YY-MM-DD" → "20YY-MM-DD" (예: 26.01.18 → 2026-01-18)
- "YYYY.MM.DD" / "YYYY/MM/DD" → "YYYY-MM-DD"
- Excel 일련번호(44000~50000 사이 숫자) → 1900-01-01 기준으로 YYYY-MM-DD 계산
- 변환 불가 행은 제외

[결제방식]
- "일시불" 또는 "할부N개월" (예: 할부3개월)
- 구분 불가시 "일시불"

[금액] 쉼표 제거 후 숫자. 취소/환불은 음수(-)

[카드사명] 마지막 컬럼에 카드명이 있으면 그대로 사용. 없으면 "알 수 없음"

[카테고리] 가맹점명 기준으로 반드시 아래 중 하나:
식비 / 생활·마트 / 교통 / 고정비 / 의료 / 문화·여가 / 골프 / 여행 / 기타
(고정비: 월세·관리비·공과금·통신·보험·정기 구독·헬스장 등 매월 반복 지출)

[절대 금지]
- 원본에 없는 행 추가 금지. 입력 행 수 = 출력 행 수
- 가맹점명을 임의로 바꾸거나 추측하지 마. 원본 텍스트 그대로 사용

JSON 배열만 응답. 마크다운/다른 텍스트 없이:
[{"date":"YYYY-MM-DD","card":"...","payType":"...","merchant":"...","amount":0,"category":"..."}]

데이터:
`;

const CLAUDE_PROMPT_2 = `
아래는 신한은행 체크카드 통장 거래내역 데이터야. 탭으로 구분되어 있어.
컬럼 순서: 거래일자 | 거래시간 | 적요 | 출금(원) | 입금(원) | 내용(가맹점) | 잔액(원) | 거래점

[필터링 - 아래 행은 제외]
- 적요가 "체크카드"가 아닌 행 (이자, 자동이체, 펌뱅킹 이체, 모바일, 현금IC, 타행인터넷뱅킹, 신한카드, 효성CD, 인터넷 등)
- 내용(가맹점)이 비어있는 행

[날짜 변환]
- "YYYY-MM-DD" 형식이면 그대로 사용
- "YY.MM.DD" / "YY/MM/DD" → "20YY-MM-DD"
- 변환 불가 행은 제외

[금액]
- 출금(원) > 0이면 양수 금액
- 입금(원) > 0이고 출금(원) = 0이면 음수(-) 금액 (환불/취소)
- 쉼표 제거 후 정수

[카드]
- 모든 행은 "신한 체크카드"로 고정

[구분]
- 이 데이터에는 할부 정보가 없으므로 모든 행 "일시불"로 고정

[카테고리] 가맹점명(내용 컬럼) 기준으로 반드시 아래 중 하나:
식비 / 카페 / 교통 / 고정비 / 문화·여가 / 여행 / 의료 / 게임 / 기타

[특정 가맹점 우선 규칙 - 아래 규칙이 일반 규칙보다 우선 적용됨]
- 가맹점명에 "갤러리아" 포함 → 식비

[일반 카테고리 규칙]
- 음식점·식당·편의점(음식류) → 식비
- 카페·커피숍·베이커리·디저트 → 카페
- 택시·버스·지하철·주유·주차 → 교통
- 월세·전세·관리비·공과금(전기·가스·수도)·통신(인터넷·휴대폰)·보험료·헬스장 정기·매월 동일한 정기결제·OTT·클라우드 구독 등 → 고정비
- 서점·공연·영화·음악 등 단건·현장 소비(정기 구독형 OTT는 고정비) → 문화·여가
- 항공·숙박·여행사 → 여행
- 약국·병원·의원 → 의료
- 게임(넥슨·스팀·넷마블 등 게임 플랫폼) → 게임
- 그 외 마트·쇼핑·기타 → 기타

[절대 금지]
- 필터링된 행 포함 금지
- 가맹점명 임의 수정 금지. 내용 컬럼 원본 텍스트 그대로 사용
- 출력 행 수 = 필터링 후 남은 행 수

JSON 배열만 응답. 마크다운/다른 텍스트 없이:
[{"date":"YYYY-MM-DD","card":"신한 체크카드","payType":"일시불","merchant":"...","amount":0,"category":"..."}]

데이터:
`;

interface ClaudeRow {
  date: string;
  card: string;
  payType: string;
  merchant: string;
  amount: number;
  category: string;
}

// 날짜 패턴: YY.MM.DD 또는 YYYY.MM.DD (구분자는 . / -)
const DATE_PATTERN = /^\d{2,4}[.\-\/]\d{2}[.\-\/]\d{2}$/;

// 소계/합계/헤더 행 판별용 키워드
const SKIP_KEYWORDS = [
  "카드소계",
  "소 계",
  "합 계",
  "합계",
  "이하 여백",
  "거래일자",
  "이용일자",
  "가맹점명",
  "이용하신",
  "총건수",
];

function isSkipRow(cell: string): boolean {
  return SKIP_KEYWORDS.some((kw) => cell.includes(kw));
}

/**
 * 포맷 A: 하나카드 스타일
 * - 카드명이 거래 행 위에 별도 행으로 존재 (예: "행복Hi-pass 후불하이패스 카드 본인 4518")
 * - 날짜가 col[0]에 위치
 */
function parseHanaFormat(raw: string[][]): string[][] {
  let currentCard = "";
  const result: string[][] = [];

  for (const row of raw) {
    const firstCell = String(row[0] ?? "").trim();

    if (DATE_PATTERN.test(firstCell)) {
      // 거래 행: 마지막에 카드명 주입
      result.push([...row, currentCard]);
    } else if (firstCell && !isSkipRow(firstCell)) {
      // 날짜도 아니고 스킵 키워드도 아니면 카드명 행으로 간주
      currentCard = firstCell;
    }
  }

  return result;
}

/**
 * 포맷 B: KB국민카드 스타일
 * - 헤더 행에 "이용카드" 컬럼 존재
 * - 카드명이 각 거래 행에 인라인으로 존재
 * - 날짜가 col[1]에 위치
 */
function parseKBFormat(raw: string[][]): string[][] {
  const result: string[][] = [];

  let dateColIdx = -1;
  let cardColIdx = -1;
  let payTypeColIdx = -1;
  let merchantColIdx = -1;
  let amountColIdx = -1;
  let installmentColIdx = -1;

  for (const row of raw) {
    const cells = row.map((c) => String(c ?? "").trim());
    const hasDate = cells.some(
      (c) => c.includes("이용일자") || c.includes("거래일자"),
    );
    const hasCard = cells.some((c) => c.includes("이용카드"));

    if (hasDate && hasCard) {
      // 헤더 행 → 컬럼 인덱스 매핑
      cells.forEach((c, i) => {
        if (c.includes("이용일자") || c.includes("거래일자")) dateColIdx = i;
        if (c.includes("이용카드")) cardColIdx = i;
        if (c.includes("구분")) payTypeColIdx = i;
        if (c.includes("가맹점") || c.includes("이용하신")) merchantColIdx = i;
        if (c.includes("이용금액")) amountColIdx = i;
        if (c.includes("할부")) installmentColIdx = i;
      });
      continue;
    }

    if (dateColIdx === -1) continue; // 헤더 아직 못 찾음

    const dateCell = String(row[dateColIdx] ?? "").trim();
    if (!DATE_PATTERN.test(dateCell)) continue; // 거래 행 아님

    // 표준화된 행으로 변환: [날짜, 구분, 가맹점, 금액, 할부, 카드명]
    const card = cardColIdx !== -1 ? String(row[cardColIdx] ?? "").trim() : "";
    const payType =
      payTypeColIdx !== -1 ? String(row[payTypeColIdx] ?? "").trim() : "";
    const merchant =
      merchantColIdx !== -1 ? String(row[merchantColIdx] ?? "").trim() : "";
    const amount =
      amountColIdx !== -1 ? String(row[amountColIdx] ?? "").trim() : "";
    const installment =
      installmentColIdx !== -1
        ? String(row[installmentColIdx] ?? "").trim()
        : "";

    result.push([dateCell, payType, merchant, amount, installment, card]);
  }

  return result;
}

/**
 * 포맷 자동 감지
 * - 헤더 행에 "이용카드" 컬럼이 있으면 KB 포맷
 * - 없으면 하나카드 포맷
 */
function detectFormat(raw: string[][]): "KB" | "HANA" {
  for (const row of raw) {
    const cells = row.map((c) => String(c ?? "").trim());
    if (cells.some((c) => c.includes("이용카드"))) {
      return "KB";
    }
  }
  return "HANA";
}

/** JSON 배열을 안전하게 추출 */
function extractJsonArray(text: string): ClaudeRow[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(
      `Claude 응답에서 JSON 배열을 찾을 수 없음.\n응답: ${text.slice(0, 300)}`,
    );
  }
  return JSON.parse(match[0]) as ClaudeRow[];
}

/** 엑셀 파일을 파싱 → 포맷 감지 → 거래 행 추출 → Claude로 정규화 → DB 저장 */
export async function processExcelAndSave(
  formData: FormData,
  userId: number,
): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
  parsedJson?: ClaudeRow[];
  detectedFormat?: string;
}> {
  // ── 파일 유효성 검사 ──────────────────────────────────────
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "엑셀 파일을 선택해 주세요." };
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return { ok: false, error: ".xlsx 또는 .xls 파일만 업로드할 수 있습니다." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." };
  }

  const uid = requireLedgerUserId(userId);

  try {
    const sourceFile = file.name;

    // ── 엑셀 파싱 ─────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return { ok: false, error: "엑셀 시트를 읽을 수 없습니다." };
    }

    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false, // 날짜/숫자를 문자열로 읽기 (Excel 일련번호 방지)
    });

    // 빈 행 제거
    const cleanRaw = raw.filter((row) =>
      row.some((cell) => String(cell).trim() !== ""),
    );

    // ── 포맷 감지 & 거래 행 추출 ──────────────────────────────
    const format = detectFormat(cleanRaw);
    const dataRows =
      format === "KB" ? parseKBFormat(cleanRaw) : parseHanaFormat(cleanRaw);

    if (dataRows.length === 0) {
      return { ok: false, error: "처리할 거래 데이터가 없습니다." };
    }

    // ── Claude API 호출 (배치 처리) ──────────────────────────
    const client = new Anthropic({ apiKey });
    const allResults: ClaudeRow[] = [];

    const claudePrompt =
      uid === LEDGER_USER_GILWOONG ? CLAUDE_PROMPT_2 : CLAUDE_PROMPT;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const batchText = batch
        .map((row) => row.map((cell) => String(cell)).join("\t"))
        .join("\n");

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: claudePrompt + batchText }],
      });

      const rawText =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      const parsed = extractJsonArray(rawText);
      allResults.push(...parsed);
    }

    if (allResults.length === 0) {
      return {
        ok: false,
        error:
          "Claude가 거래 데이터를 추출하지 못했습니다. 파일을 확인해 주세요.",
      };
    }

    const rows = allResults.map((tx) => ({
      userId: uid,
      date: new Date(tx.date),
      card: tx.card ?? "",
      payType: tx.payType ?? "일시불",
      merchant: tx.merchant ?? "",
      amount: Number(tx.amount) || 0,
      category: tx.category ?? null,
      sourceFile,
    }));
    await prisma.transaction.createMany({ data: rows });

    revalidatePath("/chart");
    return {
      ok: true,
      count: allResults.length,
      parsedJson: allResults,
      detectedFormat: format, // 디버깅용: 어떤 포맷으로 감지됐는지 확인 가능
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
