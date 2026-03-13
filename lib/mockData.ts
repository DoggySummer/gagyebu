/**
 * 프론트 목업용 데이터 (README 카테고리 기준)
 * 식비 / 생활·마트 / 교통 / 의료 / 문화·여가 / 교육 / 기타
 */

export const CATEGORIES = [
  "식비",
  "생활·마트",
  "교통",
  "의료",
  "문화·여가",
  "교육",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** 차트용 카테고리별 집계 (월별) */
export interface ChartDatum {
  category: string;
  amount: number;
}

/** 2026년 2월 목업 차트 데이터 */
export const MOCK_CHART_DATA_202602: ChartDatum[] = [
  { category: "식비", amount: 420000 },
  { category: "생활·마트", amount: 380000 },
  { category: "교통", amount: 150000 },
  { category: "의료", amount: 80000 },
  { category: "문화·여가", amount: 120000 },
  { category: "교육", amount: 200000 },
  { category: "기타", amount: 95000 },
];

/** 2026년 1월 목업 (월 변경 시 다른 수치) */
export const MOCK_CHART_DATA_202601: ChartDatum[] = [
  { category: "식비", amount: 350000 },
  { category: "생활·마트", amount: 410000 },
  { category: "교통", amount: 180000 },
  { category: "의료", amount: 0 },
  { category: "문화·여가", amount: 250000 },
  { category: "교육", amount: 150000 },
  { category: "기타", amount: 120000 },
];

export function getMockChartData(year: number, month: number): ChartDatum[] {
  const key = `${year}${String(month).padStart(2, "0")}`;
  if (key === "202601") return MOCK_CHART_DATA_202601;
  return MOCK_CHART_DATA_202602;
}

export function getMockSummary(
  data: ChartDatum[]
): { total: number; count: number; topCategory: string } {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const withSpend = data.filter((d) => d.amount > 0).length;
  const top = [...data].sort((a, b) => b.amount - a.amount)[0];
  return {
    total,
    count: withSpend * 6,
    topCategory: top?.category ?? "-",
  };
}
