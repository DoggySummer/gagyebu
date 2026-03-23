import { aggregateByCategory, totalNetSpend } from "@/lib/constants";

type TxRow = {
  date: Date;
  amount: number;
  merchant: string;
  category: string | null;
};

/** "YYYY-MM" → "2025년 3월" */
export function formatMonthKR(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** "2025-03" → "2025-02" */
export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function calendarWeekdayWeekendDaysInMonth(monthKey: string): {
  weekdayCalendarDays: number;
  weekendCalendarDays: number;
} {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  let weekdayCalendarDays = 0;
  let weekendCalendarDays = 0;
  for (let day = 1; day <= last; day++) {
    const dow = new Date(y, m - 1, day).getDay();
    if (dow === 0 || dow === 6) weekendCalendarDays++;
    else weekdayCalendarDays++;
  }
  return { weekdayCalendarDays, weekendCalendarDays };
}

/** 평일/주말 순지출(환불·취소 반영). 합 = totalNet과 일치 */
function sumByWeekdayWeekend(txs: TxRow[]): {
  weekdayTotal: number;
  weekendTotal: number;
} {
  let weekdayTotal = 0;
  let weekendTotal = 0;
  for (const t of txs) {
    const dow = new Date(t.date).getDay();
    if (dow === 0 || dow === 6) weekendTotal += t.amount;
    else weekdayTotal += t.amount;
  }
  return { weekdayTotal, weekendTotal };
}

function topMerchants(txs: TxRow[], limit: number) {
  const map = new Map<string, { count: number; total: number }>();
  for (const t of txs) {
    if (t.amount <= 0) continue;
    const m = t.merchant.trim() || "(이름 없음)";
    const cur = map.get(m) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += t.amount;
    map.set(m, cur);
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function totalSpendRefund(txs: TxRow[]) {
  let totalSpend = 0;
  let totalRefund = 0;
  for (const t of txs) {
    if (t.amount > 0) totalSpend += t.amount;
    else totalRefund += Math.abs(t.amount);
  }
  return { totalSpend, totalRefund };
}

export interface ReportStatsPayload {
  categoryTotals: Record<string, number>;
  prevCategoryTotals: Record<string, number>;
  weekdayStats: {
    평일: {
      calendarDays: number;
      총지출: number;
    };
    주말: {
      calendarDays: number;
      총지출: number;
    };
  };
  topMerchants: { merchant: string; count: number; total: number }[];
  /** 차트 페이지「총 지출」과 동일: 순지출(환불·취소 반영) */
  totalStats: {
    totalNet: number;
    /** 양수 거래만 합산(승인 총액, 환불 미반영) */
    grossOutflow: number;
    /** 음수 거래 절댓값 합 */
    refundTotal: number;
  };
  /** 고정비 카테고리 순 합계(categoryTotals.고정비와 동일) */
  fixedExpenseTotal: number;
  /** 보고서 생성 시 Prisma로 거래 테이블에서 읽어온 범위(클라이언트 캐시 없음) */
  dataLoad: {
    analyzedMonthKey: string;
    comparisonMonthKey: string;
    analyzedTransactionCount: number;
    comparisonTransactionCount: number;
  };
}

export function buildReportStats(
  monthKey: string,
  currentTxs: TxRow[],
  prevTxs: TxRow[],
): ReportStatsPayload {
  const curAgg = aggregateByCategory(currentTxs);
  const prevAgg = aggregateByCategory(prevTxs);
  const categoryTotals = Object.fromEntries(
    curAgg.map((d) => [d.category, d.amount]),
  );
  const prevCategoryTotals = Object.fromEntries(
    prevAgg.map((d) => [d.category, d.amount]),
  );
  const { weekdayCalendarDays, weekendCalendarDays } =
    calendarWeekdayWeekendDaysInMonth(monthKey);
  const { weekdayTotal, weekendTotal } = sumByWeekdayWeekend(currentTxs);
  const { totalSpend: grossOutflow, totalRefund: refundTotal } =
    totalSpendRefund(currentTxs);
  const totalNet = totalNetSpend(currentTxs);
  const fixedExpenseTotal = categoryTotals["고정비"] ?? 0;
  const comparisonMonthKey = prevMonthKey(monthKey);

  return {
    categoryTotals,
    prevCategoryTotals,
    weekdayStats: {
      평일: { calendarDays: weekdayCalendarDays, 총지출: weekdayTotal },
      주말: { calendarDays: weekendCalendarDays, 총지출: weekendTotal },
    },
    topMerchants: topMerchants(currentTxs, 5),
    totalStats: { totalNet, grossOutflow, refundTotal },
    fixedExpenseTotal,
    dataLoad: {
      analyzedMonthKey: monthKey,
      comparisonMonthKey,
      analyzedTransactionCount: currentTxs.length,
      comparisonTransactionCount: prevTxs.length,
    },
  };
}
