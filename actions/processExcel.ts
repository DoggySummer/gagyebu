"use server";

import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const BATCH_SIZE = 30;
const CLAUDE_PROMPT = `아래는 카드 사용 내역이야. 각 행은 탭으로 구분된 [날짜, 카드, 구분, 가맹점, 금액] 순서야.

날짜 변환 규칙 (반드시 적용):
- 첫 번째 값이 "YY.MM.DD" 형식(예: 26.01.18, 25.12.01)이면 20YY-MM-DD로 변환해 (26.01.18 → 2026-01-18).
- 점(.) 대신 슬래시(/)나 하이픈(-)으로 된 경우도 같은 의미(26/01/18, 26-01-18 → 2026-01-18).
- 숫자만 있는 값(예: 45321)은 Excel 날짜 일련번호이므로 1900-01-01 기준으로 YYYY-MM-DD로 변환해.
- 위 규칙으로 변환한 날짜를 date 필드에 YYYY-MM-DD만 넣어. 설명 금지.

그 외 규칙:
- 날짜를 위 규칙으로도 변환할 수 없으면 그 행만 배열에서 빼라. 설명 금지.
- 카테고리는 가맹점(가맹점명)을 보고 유추해서 넣어. 반드시 다음 중 하나로: 식비 / 생활·마트 / 교통 / 의료 / 문화·여가 / 교육 / 기타
- 금액은 원본 숫자 그대로(쉼표 제거). 다섯 번째 값이 금액이면 그걸 사용해.
- JSON 배열로만 응답하고 다른 텍스트는 포함하지 마

형식:
[{"date":"YYYY-MM-DD","card":"...","payType":"...","merchant":"...","amount":0,"category":"...","subCategory":"..."}]

데이터:
`;

interface ClaudeRow {
  date: string;
  card: string;
  payType: string;
  merchant: string;
  amount: number;
  category: string;
  subCategory?: string;
}

/** 엑셀 파일을 파싱 → Claude 프롬프트로 해석 → JSON → MySQL 저장 */
export async function processExcelAndSave(
  formData: FormData
): Promise<{ ok: boolean; count?: number; error?: string; parsedJson?: ClaudeRow[] }> {
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return { ok: false, error: "엑셀 시트를 읽을 수 없습니다." };
    }

    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    // 2단 헤더(1~3행) + 마지막 소계/합계 2행 제거 (README 기준)
    const dataRows = raw
      .slice(3, raw.length - 2)
      .filter((row) => row && row[0] && row[3]);

    if (dataRows.length === 0) {
      return { ok: false, error: "처리할 거래 데이터가 없습니다." };
    }

    const sourceFile = file.name;
    const client = new Anthropic({ apiKey });
    const allResults: ClaudeRow[] = [];

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const batchText = batch
      .map((row) => [row[0], row[1], row[2], row[3], row[5]].join("\t"))
      .join("\n");

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: CLAUDE_PROMPT + batchText,
          },
        ],
      });

      const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";
      // Claude가 ```json ... ``` 마크다운으로 감싸서 보낼 수 있음 → 제거 후 파싱
      const text = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(text) as ClaudeRow[];
      allResults.push(...parsed);
    }

    await prisma.transaction.createMany({
      data: allResults.map((tx) => ({
        date: new Date(tx.date),
        card: tx.card ?? "",
        payType: tx.payType ?? "일시불",
        merchant: tx.merchant ?? "",
        amount: Number(tx.amount) || 0,
        category: tx.category ?? null,
        subCategory: tx.subCategory ?? null,
        sourceFile,
      })),
    });

    revalidatePath("/chart");
    return { ok: true, count: allResults.length, parsedJson: allResults };
  } catch (e) {
    const message = e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
