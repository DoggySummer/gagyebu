/**
 * 카테고리 상수 (README 기준)
 */
export const CATEGORIES = [
  "식비",
  "생활·마트",
  "교통",
  "의료",
  "문화·여가",
  "게임",
  "골프",
  "여행",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** 차트용 카테고리별 집계 */
export interface ChartDatum {
  category: string;
  amount: number;
}

/** 거래 목록을 카테고리별 합계로 집계 */
export function aggregateByCategory(
  transactions: { category: string | null; amount: number }[]
): ChartDatum[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const cat = t.category ?? "기타";
    map.set(cat, (map.get(cat) ?? 0) + t.amount);
  }
  return CATEGORIES.map((category) => ({
    category,
    amount: map.get(category) ?? 0,
  }));
}

/** 차트 데이터로 요약 계산 */
export function getSummary(data: ChartDatum[], count: number) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const top = [...data].sort((a, b) => b.amount - a.amount)[0];
  return {
    total,
    count,
    topCategory: top?.amount ? top.category : "-",
  };
}
