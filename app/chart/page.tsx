"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import { AgGridReact, AgGridProvider } from "ag-grid-react";
import { AllCommunityModule, themeQuartz, type ColDef } from "ag-grid-community";

const gridModules = [AllCommunityModule];
import Sidebar from "@/components/Sidebar";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import TransactionActionsCell from "@/components/charts/TransactionActionsCell";
import { getTransactions, updateTransaction, deleteTransaction } from "@/actions/transactions";
import {
  aggregateByCategory,
  getSummary,
  CATEGORIES,
  type ChartDatum,
} from "@/lib/constants";

type TransactionRow = Awaited<ReturnType<typeof getTransactions>>[number];

export default function ChartPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [chartData, setChartData] = useState<ChartDatum[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    count: 0,
    topCategory: "-",
  });
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<TransactionRow | null>(null);
  const [editForm, setEditForm] = useState({
    merchant: "",
    amount: 0,
    category: "",
  });
  const [compareMonthKey, setCompareMonthKey] = useState<string | null>(null);
  const [compareChartData, setCompareChartData] = useState<ChartDatum[]>([]);
  const compareChartContainerRef = useRef<HTMLDivElement>(null);
  const [compareChartWidth, setCompareChartWidth] = useState(320);
  const [compareChartTooltip, setCompareChartTooltip] = useState<{
    category: string;
    diff: number;
    x: number;
    y: number;
  } | null>(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    const check = () => setIsNarrowScreen(typeof window !== "undefined" && window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const el = compareChartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 320;
      setCompareChartWidth(Math.min(640, Math.max(240, w)));
    });
    ro.observe(el);
    setCompareChartWidth(
      Math.min(640, Math.max(240, el.getBoundingClientRect().width || 320))
    );
    return () => ro.disconnect();
  }, []);

  /** 비교용으로 선택 가능한 이전 월 목록 (현재 월 제외, 최근 12개월) */
  const compareMonthOptions = useMemo(() => {
    const options: { key: string; label: string }[] = [];
    const d = new Date(year, month - 1, 1);
    for (let i = 1; i <= 12; i++) {
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      options.push({ key, label: `${y}년 ${m}월` });
    }
    return options;
  }, [year, month]);

  /** 이전 월과 비교 차트: 증감 바 차트용 스케일·데이터 (높이 260, 옆 차트와 동일, 너비 반응형) */
  const COMPARE_CHART_H = 260;
  const COMPARE_CHART_P = { top: 20, right: 20, bottom: 30, left: 76 };
  const COMPARE_BAR_MIN_HOVER_HEIGHT = 24;
  const compareChartInnerW = compareChartWidth - COMPARE_CHART_P.left - COMPARE_CHART_P.right;
  const compareChartInnerH = COMPARE_CHART_H - COMPARE_CHART_P.top - COMPARE_CHART_P.bottom;

  const compareChartScales = useMemo(() => {
    if (!compareMonthKey || compareChartData.length === 0 || compareChartInnerW <= 0)
      return null;
    const diffData = CATEGORIES.map((category) => {
      const current = chartData.find((d) => d.category === category)?.amount ?? 0;
      const compare = compareChartData.find((d) => d.category === category)?.amount ?? 0;
      return { category, diff: current - compare };
    });
    const allDiffs = diffData.map((d) => d.diff);
    const minD = Math.min(0, ...allDiffs);
    const maxD = Math.max(0, ...allDiffs);
    const extent = Math.max(Math.abs(minD), Math.abs(maxD), 1);
    const xScale = d3
      .scaleBand<string>()
      .domain(CATEGORIES)
      .range([0, compareChartInnerW])
      .padding(0.35);
    const yScale = d3
      .scaleLinear()
      .domain([-extent, extent])
      .range([compareChartInnerH, 0]);
    const zeroY = yScale(0);
    return { diffData, xScale, yScale, zeroY };
  }, [compareMonthKey, compareChartData, chartData, compareChartInnerW]);

  /** 이전 월과 비교 요약: 총 지출 증감, 늘어난/줄어든 카테고리 */
  const compareSummary = useMemo(() => {
    if (!compareMonthKey || compareChartData.length === 0) return null;
    const totalCurrent = chartData.reduce((s, d) => s + d.amount, 0);
    const totalCompare = compareChartData.reduce((s, d) => s + d.amount, 0);
    const totalDiff = totalCurrent - totalCompare;
    const increased: string[] = [];
    const decreased: string[] = [];
    CATEGORIES.forEach((category) => {
      const current = chartData.find((d) => d.category === category)?.amount ?? 0;
      const compare = compareChartData.find((d) => d.category === category)?.amount ?? 0;
      const diff = current - compare;
      if (diff > 0) increased.push(category);
      else if (diff < 0) decreased.push(category);
    });
    return { totalDiff, increased, decreased };
  }, [compareMonthKey, compareChartData, chartData]);

  const refetch = useCallback(() => {
    getTransactions(monthKey).then((txs) => {
      setTransactions(txs);
      const aggregated = aggregateByCategory(txs);
      setChartData(aggregated);
      setSummary(getSummary(aggregated, txs.length));
    });
  }, [monthKey]);

  const columnDefs = useMemo<ColDef<TransactionRow>[]>(
    () => [
      {
        field: "date",
        headerName: "날짜",
        sortable: true,
        valueFormatter: (p) =>
          p.value ? new Date(p.value).toISOString().slice(0, 10) : "",
        comparator: (a, b) =>
          new Date(a).getTime() - new Date(b).getTime(),
      },
      { field: "merchant", headerName: "가맹점", sortable: true },
      {
        field: "amount",
        headerName: "금액",
        sortable: true,
        valueFormatter: (p) =>
          p.value != null ? `${Number(p.value).toLocaleString()}원` : "",
        comparator: (a, b) => (a ?? 0) - (b ?? 0),
      },
      { field: "category", headerName: "카테고리", sortable: true },
      { field: "card", headerName: "카드", sortable: true },
      { field: "payType", headerName: "구분", sortable: true },
      {
        headerName: "작업",
        sortable: false,
        flex: 1,
        minWidth: 120,
        cellRenderer: TransactionActionsCell,
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef<TransactionRow>>(
    () => ({ sortable: true, resizable: true }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTransactions(monthKey).then((txs) => {
      if (cancelled) return;
      setTransactions(txs);
      const aggregated = aggregateByCategory(txs);
      setChartData(aggregated);
      setSummary(getSummary(aggregated, txs.length));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [monthKey]);

  useEffect(() => {
    if (!compareMonthKey) {
      setCompareChartData([]);
      return;
    }
    getTransactions(compareMonthKey).then((txs) => {
      setCompareChartData(aggregateByCategory(txs));
    });
  }, [compareMonthKey]);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="flex min-h-screen relative w-full md:max-w-[80vw] md:mx-auto">
      <Sidebar />
      <div className="flex-1 p-4 pt-14 pb-8 md:pt-6 md:p-8 min-w-0">
        <header className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={prevMonth}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] p-2 rounded-lg hover:bg-black/5 transition-colors text-xl leading-none cursor-pointer"
            aria-label="이전 달"
          >
            ‹
          </button>
          <h1 className="text-lg font-semibold text-[var(--text)]">
            {year}년 {month}월
          </h1>
          <button
            type="button"
            onClick={nextMonth}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] p-2 rounded-lg hover:bg-black/5 transition-colors text-xl leading-none cursor-pointer"
            aria-label="다음 달"
          >
            ›
          </button>
        </header>

        {loading ? (
          <p className="text-[var(--text-muted)]">불러오는 중...</p>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div
                className="rounded-xl border border-[var(--border)] p-5"
                style={{ background: "var(--card-bg)" }}
              >
                <p className="text-sm text-[var(--text-muted)] mb-1">총 지출</p>
                <p className="text-xl font-semibold text-[var(--accent)]">
                  {summary.total.toLocaleString()}원
                </p>
              </div>
              <div
                className="rounded-xl border border-[var(--border)] p-5"
                style={{ background: "var(--card-bg)" }}
              >
                <p className="text-sm text-[var(--text-muted)] mb-1">항목 수</p>
                <p className="text-xl font-semibold text-[var(--text)]">
                  {summary.count}건
                </p>
              </div>
              <div
                className="rounded-xl border border-[var(--border)] p-5"
                style={{ background: "var(--card-bg)" }}
              >
                <p className="text-sm text-[var(--text-muted)] mb-1">최대 지출 카테고리</p>
                <p className="text-xl font-semibold text-[var(--text)]">
                  {summary.topCategory}
                </p>
              </div>
            </section>

            <section className="flex flex-col xl:flex-row gap-8 items-stretch">
              <div
                className="rounded-xl border border-[var(--border)] p-6 flex flex-col items-center flex-1 min-h-[340px] min-w-0"
                style={{ background: "var(--card-bg)" }}
              >
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                  카테고리별 지출
                </h2>
                <BarChart key={`bar-${monthKey}`} data={chartData} animationKey={monthKey} />
              </div>
              <div
                className="rounded-xl border border-[var(--border)] p-6 flex flex-col items-center flex-1 min-h-[340px] min-w-0"
                style={{ background: "var(--card-bg)" }}
              >
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                  비율
                </h2>
                <DonutChart key={`donut-${monthKey}`} data={chartData} animationKey={monthKey} />
              </div>
              <div
                className="rounded-xl border border-[var(--border)] p-6 flex flex-col items-center flex-1 min-h-[340px] min-w-0"
                style={{ background: "var(--card-bg)" }}
              >
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                  이전 월과 비교
                </h2>
                <div className="mb-3 w-full max-w-[180px]">
                  <select
                    value={compareMonthKey ?? ""}
                    onChange={(e) => setCompareMonthKey(e.target.value || null)}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full"
                    aria-label="비교할 월 선택"
                  >
                    <option value="">비교할 월 선택</option>
                    {compareMonthOptions.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {compareMonthKey && compareChartScales ? (
                  <div className="flex flex-col lg:flex-row gap-4 w-full min-w-0 items-start">
                    <div
                      ref={compareChartContainerRef}
                      className="min-w-0 overflow-x-auto flex-shrink-0"
                      style={{ maxWidth: 640 }}
                    >
                      <svg
                        width={compareChartWidth}
                        height={COMPARE_CHART_H}
                        className="overflow-visible"
                        style={{ maxWidth: "100%" }}
                      >
                        <g transform={`translate(${COMPARE_CHART_P.left},${COMPARE_CHART_P.top})`}>
                          {/* 0 기준선 */}
                          <line
                            x1={0}
                            x2={compareChartInnerW}
                            y1={compareChartScales.zeroY}
                            y2={compareChartScales.zeroY}
                            stroke="var(--border)"
                            strokeWidth={1}
                            strokeDasharray="4,2"
                          />
                          {/* Y축 눈금·레이블 */}
                          {compareChartScales.yScale.ticks(5).map((tick) => {
                            const y = compareChartScales.yScale(tick);
                            return (
                              <g key={tick} transform={`translate(0,${y})`}>
                                <line
                                  x1={0}
                                  x2={compareChartInnerW}
                                  stroke="var(--border)"
                                  strokeWidth={0.5}
                                  strokeDasharray="2,2"
                                />
                                <text
                                  x={-8}
                                  y={0}
                                  dy="0.32em"
                                  textAnchor="end"
                                  fill="#78716c"
                                  fontSize={11}
                                >
                                  {tick >= 0 ? `+${tick.toLocaleString()}` : tick.toLocaleString()}
                                </text>
                              </g>
                            );
                          })}
                          {/* X축 카테고리 레이블 */}
                          {CATEGORIES.map((category) => {
                            const x = compareChartScales.xScale(category) ?? 0;
                            return (
                              <text
                                key={category}
                                x={x + compareChartScales.xScale.bandwidth() / 2}
                                y={compareChartInnerH + 16}
                                textAnchor="middle"
                                fill="#78716c"
                                fontSize={11}
                              >
                                {category}
                              </text>
                            );
                          })}
                          {/* 증감 바: 이번 달 > 전월 → 위, 전월 > 이번 달 → 아래 */}
                          {compareChartScales.diffData.map(({ category, diff }) => {
                            const x = compareChartScales.xScale(category) ?? 0;
                            const y0 = compareChartScales.zeroY;
                            const y1 = compareChartScales.yScale(diff);
                            const y = Math.min(y0, y1);
                            const height = Math.abs(y1 - y0);
                            const fill =
                              diff > 0 ? "#dc2626" : diff < 0 ? "#059669" : "var(--text-muted)";
                            const hoverHeight = Math.max(height, COMPARE_BAR_MIN_HOVER_HEIGHT);
                            const hoverY = y - (hoverHeight - height) / 2;
                            return (
                              <g key={category}>
                                <rect
                                  x={x}
                                  y={y}
                                  width={compareChartScales.xScale.bandwidth()}
                                  height={height}
                                  fill={fill}
                                  rx={2}
                                />
                                <rect
                                  x={x}
                                  y={hoverY}
                                  width={compareChartScales.xScale.bandwidth()}
                                  height={hoverHeight}
                                  fill="transparent"
                                  onMouseEnter={(e) =>
                                    setCompareChartTooltip({
                                      category,
                                      diff,
                                      x: e.clientX,
                                      y: e.clientY,
                                    })
                                  }
                                  onMouseLeave={() => setCompareChartTooltip(null)}
                                />
                              </g>
                            );
                          })}
                        </g>
                      </svg>
                    </div>
                    {compareSummary && (
                      <div className="text-sm min-w-0 max-w-[220px] lg:max-w-[260px] space-y-4 pt-1">
                        <div className="min-w-0">
                          <p className="text-[var(--text-muted)] mb-0.5">총 지출 비교</p>
                          <p className="text-[var(--text)] break-words">
                            {compareSummary.totalDiff > 0 ? (
                              <span className="text-red-600 font-medium">
                                {compareSummary.totalDiff.toLocaleString()}원 증가
                              </span>
                            ) : compareSummary.totalDiff < 0 ? (
                              <span className="text-emerald-600 font-medium">
                                {Math.abs(compareSummary.totalDiff).toLocaleString()}원 감소
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">변동 없음</span>
                            )}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text-muted)] mb-0.5">늘어난 카테고리</p>
                          <p className="text-red-600 break-words">
                            {compareSummary.increased.length > 0
                              ? compareSummary.increased.join(", ")
                              : "-"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text-muted)] mb-0.5">줄어든 카테고리</p>
                          <p className="text-emerald-600 break-words">
                            {compareSummary.decreased.length > 0
                              ? compareSummary.decreased.join(", ")
                              : "-"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : compareMonthKey ? (
                  <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">위에서 비교할 월을 선택하세요.</p>
                )}
                {compareChartTooltip && (
                  <div
                    className="fixed z-10 px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none border border-[var(--border)]"
                    style={{
                      left: isNarrowScreen ? 12 : compareChartTooltip.x + 12,
                      top: compareChartTooltip.y + 12,
                      background: "var(--card-bg)",
                      color: "var(--text)",
                    }}
                  >
                    <div className="font-medium">{compareChartTooltip.category}</div>
                    <div className="text-[var(--text-muted)]">
                      {compareChartTooltip.diff > 0 ? (
                        <span className="text-red-600">
                          +{compareChartTooltip.diff.toLocaleString()}원 증가
                        </span>
                      ) : compareChartTooltip.diff < 0 ? (
                        <span className="text-emerald-600">
                          {compareChartTooltip.diff.toLocaleString()}원 감소
                        </span>
                      ) : (
                        "변동 없음"
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <AgGridProvider modules={gridModules}>
              <section
                className="rounded-xl border border-[var(--border)] overflow-hidden mt-6 md:mt-8 p-3 md:p-4"
                style={{ background: "var(--card-bg)" }}
              >
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  거래 목록
                </h2>
                <div className="overflow-x-auto -mx-1">
                  <div className="min-w-[600px]" style={{ height: 320 }}>
                  <AgGridReact<TransactionRow>
                    theme={themeQuartz}
                    rowData={transactions}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    domLayout="normal"
                    suppressCellFocus
                    context={{
                      onEdit: (data: { id: number }) => {
                        const row = transactions.find((t) => t.id === data.id);
                        if (row) {
                          setEditingRow(row);
                          setEditForm({
                            merchant: row.merchant,
                            amount: row.amount,
                            category: row.category ?? "",
                          });
                        }
                      },
                      onDelete: async (data: { id: number }) => {
                        if (!confirm("이 거래를 삭제할까요?")) return;
                        await deleteTransaction(data.id);
                        refetch();
                      },
                    }}
                  />
                  </div>
                </div>
              </section>
            </AgGridProvider>

            {/* 수정 모달 */}
            {editingRow && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-modal-title"
              >
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setEditingRow(null)}
                  aria-hidden
                />
                <div
                  className="relative rounded-xl border border-[var(--border)] p-6 w-full max-w-md shadow-xl"
                  style={{ background: "var(--card-bg)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="edit-modal-title" className="text-lg font-semibold text-[var(--text)] mb-4">
                    거래 수정
                  </h2>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!editingRow) return;
                      await updateTransaction(editingRow.id, {
                        merchant: editForm.merchant,
                        amount: editForm.amount,
                        category: editForm.category || null,
                      });
                      refetch();
                      setEditingRow(null);
                    }}
                  >
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-1">가맹점</label>
                      <input
                        type="text"
                        value={editForm.merchant}
                        onChange={(e) => setEditForm((f) => ({ ...f, merchant: e.target.value }))}
                        className="input-dark w-full rounded-lg px-4 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-1">금액 (원)</label>
                      <input
                        type="number"
                        value={editForm.amount || ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                        className="input-dark w-full rounded-lg px-4 py-2"
                        min={1}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-1">카테고리</label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                        className="input-dark w-full rounded-lg px-4 py-2"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="btn-primary flex-1 rounded-lg py-2.5 font-medium cursor-pointer">
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRow(null)}
                        className="flex-1 rounded-lg py-2.5 font-medium border border-[var(--border)] hover:bg-black/5 cursor-pointer"
                        style={{ color: "var(--text)" }}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
