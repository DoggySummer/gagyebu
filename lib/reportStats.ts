import { aggregateByCategory } from "@/lib/constants";

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

function sumByWeekdayWeekend(txs: TxRow[]): {
  weekdayTotal: number;
  weekendTotal: number;
} {
  let weekdayTotal = 0;
  let weekendTotal = 0;
  for (const t of txs) {
    if (t.amount <= 0) continue;
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
  totalStats: { totalSpend: number; totalRefund: number };
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
  const { totalSpend, totalRefund } = totalSpendRefund(currentTxs);

  return {
    categoryTotals,
    prevCategoryTotals,
    weekdayStats: {
      평일: { calendarDays: weekdayCalendarDays, 총지출: weekdayTotal },
      주말: { calendarDays: weekendCalendarDays, 총지출: weekendTotal },
    },
    topMerchants: topMerchants(currentTxs, 5),
    totalStats: { totalSpend, totalRefund },
  };
}
