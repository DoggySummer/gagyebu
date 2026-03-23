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
import type { Transaction } from "@prisma/client";

/* ------------------------------------------------------------------ */
/*  DB 조회                                                            */
/* ------------------------------------------------------------------ */

async function fetchReportTransactionsFromDb(
  monthKey: string,
  ledgerUserId: number,
): Promise<{
  previousMonthKey: string;
  currentTxs: Transaction[];
  prevTxs: Transaction[];
}> {
  const previousMonthKey = prevMonthKey(monthKey);
  const [currentTxs, prevTxs] = await Promise.all([
    getTransactions(monthKey, ledgerUserId),
    getTransactions(previousMonthKey, ledgerUserId),
  ]);
  return { previousMonthKey, currentTxs, prevTxs };
}

/* ------------------------------------------------------------------ */
/*  프롬프트 빌더 (모든 수치를 JS에서 사전 계산)                        */
/* ------------------------------------------------------------------ */

function buildReportPrompt(month: string, stats: ReportStatsPayload): string {
  const MONTHLY_INCOME = 3_170_000;

  // ── 헬퍼 ─────────────────────────────────────────────
  const totalNet = stats.totalStats.totalNet;
  const fixed = stats.fixedExpenseTotal;
  const cat = (name: string) => stats.categoryTotals[name] ?? 0;
  const prevCat = (name: string) => stats.prevCategoryTotals[name] ?? 0;

  // ── 고정지출 비율 ────────────────────────────────────
  const fixedRatio =
    totalNet > 0 ? ((fixed / totalNet) * 100).toFixed(1) : "0";

  // ── 과소비지수 ───────────────────────────────────────
  const spendingIndex = (totalNet / MONTHLY_INCOME).toFixed(2);

  // ── 엥겔지수 ────────────────────────────────────────
  const foodCafe = cat("식비") + cat("카페");
  const engelIndex =
    totalNet > 0 ? ((foodCafe / totalNet) * 100).toFixed(1) : "0";

  // ── 주말·평일 1일 평균 ──────────────────────────────
  const wd = stats.weekdayStats["평일"];
  const we = stats.weekdayStats["주말"];
  const wdAvg =
    wd.calendarDays > 0 ? Math.round(wd["총지출"] / wd.calendarDays) : 0;
  const weAvg =
    we.calendarDays > 0 ? Math.round(we["총지출"] / we.calendarDays) : 0;
  const weMultiple = wdAvg > 0 ? (weAvg / wdAvg).toFixed(1) : "N/A";

  // ── 카테고리별 지출 (높은 순) ───────────────────────
  const categoryLines = Object.entries(stats.categoryTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => {
      const pct =
        totalNet > 0 ? ((amount / totalNet) * 100).toFixed(1) : "0";
      return `${name}: ${amount.toLocaleString()}원 (${pct}%)`;
    })
    .join("\n  ");

  // ── TOP 3 카테고리 ──────────────────────────────────
  const top3Categories = Object.entries(stats.categoryTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, amount]) => {
      const pct =
        totalNet > 0 ? ((amount / totalNet) * 100).toFixed(1) : "0";
      return `${name}: ${amount.toLocaleString()}원 (${pct}%)`;
    })
    .join("\n  ");

  // ── TOP 3 가맹점 ───────────────────────────────────
  const top3Merchants = stats.topMerchants
    .slice(0, 3)
    .map((m) => `${m.merchant}: ${m.count}회, ${m.total.toLocaleString()}원`)
    .join("\n  ");

  // ── 전월 대비 50%↑ 카테고리 ────────────────────────
  const surgeCategories = Object.entries(stats.categoryTotals)
    .filter(([name, cur]) => {
      const prev = prevCat(name);
      return prev > 0 && cur > 0 && cur / prev >= 1.5;
    })
    .map(([name, cur]) => {
      const prev = prevCat(name);
      const rate = (((cur - prev) / prev) * 100).toFixed(0);
      return `${name}: +${rate}% (${prev.toLocaleString()}원 → ${cur.toLocaleString()}원)`;
    });
  const surgeText =
    surgeCategories.length > 0
      ? surgeCategories.join("\n  ")
      : "해당 없음 — 전월 대비 급격히 늘어난 항목 없음";

  // ── 가장 큰 변동비 카테고리 (고정비 제외) ───────────
  const largestVariable = Object.entries(stats.categoryTotals)
    .filter(([name, v]) => name !== "고정비" && v > 0)
    .sort(([, a], [, b]) => b - a)[0];
  const largestVarName = largestVariable?.[0] ?? "기타";
  const largestVarAmount = largestVariable?.[1] ?? 0;
  const largestVar20pct = Math.round(largestVarAmount * 0.2);

  // ── 조건별 코멘트 가이드 ────────────────────────────
  const fixedComment =
    Number(fixedRatio) <= 50
      ? "→ 50% 이하: 고정비 관리 양호, 변동비 절약 여지 충분"
      : Number(fixedRatio) <= 70
        ? "→ 50~70%: 고정비 다소 높음, 구독·보험 등 점검 권장"
        : "→ 70% 이상: 고정비가 대부분, 항목별 재검토 필요";

  const idx = Number(spendingIndex);
  const spendingComment =
    idx < 0.5
      ? "→ 0.5 미만: 이상적 소비 수준, 수입 절반 이상 저축"
      : idx < 0.7
        ? "→ 0.5~0.7: 적정 균형, 페이스 유지 권장"
        : idx < 1.0
          ? `→ 0.7~1.0: 소비 다소 많음. ${largestVarName}에서 20% 줄이면 월 약 ${largestVar20pct.toLocaleString()}원 절약 가능`
          : `→ 1.0 이상: 적자 ${(totalNet - MONTHLY_INCOME).toLocaleString()}원. ${largestVarName} 지출 우선 조정 권장`;

  // ── 프롬프트 본문 ──────────────────────────────────
  return `
아래는 사용자의 ${month} 가계부 통계야.
모든 수치는 사전에 계산된 값이므로 **직접 산술 계산하지 말고 아래 값을 그대로 인용**해.

━━━━━━━━━━ 사전 계산 결과 ━━━━━━━━━━

■ 총 지출(순지출): ${totalNet.toLocaleString()}원
■ 고정지출: ${fixed.toLocaleString()}원 | 고정지출 비율: ${fixedRatio}%
  ${fixedComment}
■ 과소비지수: ${spendingIndex} (순지출 ${totalNet.toLocaleString()}원 / 수입 ${MONTHLY_INCOME.toLocaleString()}원)
  ${spendingComment}
■ 엥겔지수: ${engelIndex}% (식비+카페 ${foodCafe.toLocaleString()}원 / 순지출 ${totalNet.toLocaleString()}원)
  식비: ${cat("식비").toLocaleString()}원 | 카페: ${cat("카페").toLocaleString()}원
■ 평일 1일 평균: ${wdAvg.toLocaleString()}원 (${wd.calendarDays}일)
  주말 1일 평균: ${weAvg.toLocaleString()}원 (${we.calendarDays}일)
  주말/평일 배수: ${weMultiple}배

■ 카테고리별 지출 (높은 순):
  ${categoryLines}

■ TOP 3 카테고리:
  ${top3Categories}

■ TOP 3 가맹점:
  ${top3Merchants}

■ 전월 대비 50% 이상 증가:
  ${surgeText}

■ 가장 큰 변동비 카테고리: ${largestVarName} (${largestVarAmount.toLocaleString()}원)
  → 20% 절감 시: 월 약 ${largestVar20pct.toLocaleString()}원 절약

━━━━━━━━━━ 분석 항목 (순서 준수) ━━━━━━━━━━

## 📊 ${month} 요약
- 총 지출 ${totalNet.toLocaleString()}원을 한 문장으로 자연스럽게 작성
- 카테고리별 지출을 금액과 비율로 나열 (위 "카테고리별 지출" 그대로 사용)

## 🏆 이달의 TOP
- TOP 3 카테고리 금액·비율
- TOP 3 가맹점 방문 횟수·금액

## 🔒 고정지출 비율
- "이번 달 고정지출은 ${fixed.toLocaleString()}원으로 전체 지출의 ${fixedRatio}%예요."
- 위 코멘트 가이드에 맞는 한 줄 코멘트 추가

## 💰 과소비지수
- "이번 달 과소비지수는 ${spendingIndex} (순지출 ${totalNet.toLocaleString()}원 / 수입 ${MONTHLY_INCOME.toLocaleString()}원)이에요."
- 위 코멘트 가이드에 맞는 구체적 조언 (금액 포함)

## 🥗 엥겔지수 분석
- "이번 달 식비·카페 합산 ${foodCafe.toLocaleString()}원으로 전체 지출의 ${engelIndex}%예요."
- 25% 미만이면 "식비·카페 관리가 잘 되고 있어요 👍" 한 문장으로 마무리
- 25% 이상이면 카페 격일 줄이기·외식 주1회 줄이기 구체적 절약액 제시

## 📅 주말 vs 평일 패턴
- 평일 ${wdAvg.toLocaleString()}원/일, 주말 ${weAvg.toLocaleString()}원/일 나란히 언급
- 주말이 평일의 2배 이상(${weMultiple}배)일 때만 주말 예산 제안, 아니면 수치만 나열

## 📈 전월 대비
- 위 "전월 대비 50% 이상 증가" 데이터 그대로 사용
- 해당 없으면 "급격히 늘어난 항목이 없어요 👍"

## 💡 총평 & 다음 달 조언
- 잘한 점 1가지 이상 (구체적 수치)
- 실천 가능한 조언 1~2가지 (구체적 금액·횟수)
- 마지막 격려 한 문장

━━━━━━━━━━ 절대 금지 ━━━━━━━━━━
- 위에 제공한 수치를 직접 재계산하거나 다른 값으로 바꾸기 금지
- 표, 코드블록 사용 금지
- "줄여야 합니다", "위험합니다", "문제입니다" 같은 부정적 단정 표현 금지
- 수치 없는 막연한 조언 금지
- 항목 순서 변경 금지
- 환불 관련 내용 일체 금지

━━━━━━━━━━ 응답 형식 ━━━━━━━━━━
- 마크다운 형식, 각 항목 제목은 ## (heading 2)
- 각 항목 사이 빈 줄로 단락 분리
- 친근하고 실용적인 톤
- 전체 길이 600~800자 이내
`;
}

/* ------------------------------------------------------------------ */
/*  공개 API                                                           */
/* ------------------------------------------------------------------ */

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
    const { currentTxs, prevTxs } = await fetchReportTransactionsFromDb(
      monthKey,
      uid,
    );

    if (currentTxs.length === 0) {
      return {
        ok: false,
        error: "해당 월에 거래 데이터가 없어 보고서를 만들 수 없습니다.",
      };
    }

    const stats = buildReportStats(monthKey, currentTxs, prevTxs);
    const monthLabel = formatMonthKR(monthKey);
    const userContent = buildReportPrompt(monthLabel, stats);

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