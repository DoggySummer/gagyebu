"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireLedgerUserId } from "@/lib/ledgerUser";
import { getTransactions } from "@/actions/transactions";
import {
  buildReportStats,
  formatMonthKR,
  prevMonthKey,
  type ReportStatsPayload,
} from "@/lib/reportStats";
import { revalidatePath } from "next/cache";

function buildReportPrompt(
  month: string,
  prevMonthStr: string,
  stats: ReportStatsPayload,
): string {
  return `
아래는 사용자의 ${month} 가계부 통계 데이터야 (SQL 집계 결과).

[사전 계산 - 이미 계산된 값이므로 그대로 사용]
- categoryTotals: 이번달 카테고리별 지출 합계
- prevCategoryTotals: 전월(${prevMonthStr}) 카테고리별 지출 합계
- weekdayStats: 평일/주말 일수 및 지출 합계
- topMerchants: 자주 방문한 가맹점 TOP 5
- totalStats: 총 지출 / 총 환불 금액

[분석 항목]

1. 📊 ${month} 요약
- 총 지출 금액과 환불 금액을 한 문장으로 자연스럽게 작성
- 카테고리별 지출을 금액과 비율로 나열 (높은 순)

2. 🏆 이달의 TOP
- 지출이 많은 카테고리 TOP 3를 금액과 비율로 언급
- 자주 방문한 가맹점 TOP 3를 방문 횟수와 총 금액으로 언급

3. 🥗 엥겔지수 분석
- 엥겔지수 = (식비 + 카페) / 총 지출 * 100
- 반드시 아래 형식으로 작성:
  "이번 달 식비·카페 합산 {식비+카페 금액}원으로 전체 지출의 {엥겔지수}%예요.
   카페를 격일로 줄이면 월 약 {카페금액/2}원,
   외식을 주 1회 줄이면 약 {식비/식비건수}원 절약할 수 있어요."
- 25% 미만이면: "식비·카페 관리가 잘 되고 있어요 👍" 한 문장으로 마무리
- "높아요", "줄이세요", "주의하세요" 같은 단순 경고 표현 절대 금지
- 수치 없는 코멘트 금지. 반드시 구체적인 금액 포함

4. 📅 주말 vs 평일 패턴
- 평일 1일 평균 = 평일 total / 평일 days
- 주말 1일 평균 = 주말 total / 주말 days
- 두 수치를 나란히 언급하고 자연스럽게 한 문장으로 마무리
- 주말 1일 평균이 평일의 2배 이상일 때만:
  "주말 지출이 평일의 {N}배예요. 주말에 {가장 많이 쓴 카테고리}가 집중되는 패턴이에요.
   주말 예산을 미리 {평일 1일 평균 * 1.5}원 정도로 정해두면 도움이 될 수 있어요."
- 2배 미만이면 비율 언급 없이 수치만 나열

5. 📈 전월 대비
- 전월 대비 50% 이상 증가한 카테고리만:
  "{카테고리} 지출이 지난달보다 {증가율}% 늘었어요. ({전월금액}원 → {이번달금액}원)"
- 해당 없으면: "이번 달은 전월 대비 급격히 늘어난 항목이 없어요 👍"
- 증가 이유를 단정짓는 표현 금지

6. 💡 총평 & 다음 달 조언
- 잘한 점 1가지 이상 반드시 구체적인 수치와 함께 언급
- 다음 달 실천 가능한 조언 1~2가지를 구체적인 금액과 횟수로 제시
- 마지막은 격려 한 문장으로 마무리

[절대 금지]
- 표, 마크다운 테이블, 코드블록 사용 금지
- "줄여야 합니다", "위험합니다", "문제입니다" 같은 부정적 단정 표현 금지
- 수치 없는 막연한 조언 금지 (ex. "카페를 줄여보세요" → 금지)
- 항목 순서 변경 금지

[응답 형식]
- 각 항목은 이모지 헤더로 시작
- 친근하고 실용적인 톤
- 전체 길이는 400~600자 이내

데이터:
${JSON.stringify(stats, null, 2)}
`;
}

/** 저장된 월별 보고서 조회 */
export async function getMonthlyReport(
  monthKey: string,
  userId: number,
): Promise<{ body: string } | null> {
  const uid = requireLedgerUserId(userId);
  const row = await prisma.monthlyReport.findUnique({
    where: {
      userId_monthKey: { userId: uid, monthKey },
    },
  });
  return row ? { body: row.body } : null;
}

/** Claude로 보고서 생성 후 DB 저장 */
export async function generateMonthlyReport(
  monthKey: string,
  userId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." };
  }

  const uid = requireLedgerUserId(userId);

  try {
    const currentTxs = await getTransactions(monthKey, uid);
    const prevKey = prevMonthKey(monthKey);
    const prevTxs = await getTransactions(prevKey, uid);

    if (currentTxs.length === 0) {
      return {
        ok: false,
        error: "해당 월에 거래 데이터가 없어 보고서를 만들 수 없습니다.",
      };
    }

    const stats = buildReportStats(monthKey, currentTxs, prevTxs);
    const monthLabel = formatMonthKR(monthKey);
    const prevLabel = formatMonthKR(prevKey);
    const userContent = buildReportPrompt(monthLabel, prevLabel, stats);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const body = rawText.trim();
    if (!body) {
      return { ok: false, error: "보고서 텍스트를 받지 못했습니다." };
    }

    await prisma.monthlyReport.upsert({
      where: { userId_monthKey: { userId: uid, monthKey } },
      create: { userId: uid, monthKey, body },
      update: { body },
    });

    revalidatePath("/report");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "보고서 생성 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
