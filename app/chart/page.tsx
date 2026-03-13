"use client";

import { useState, useEffect, useMemo } from "react";
import { AgGridReact, AgGridProvider } from "ag-grid-react";
import { AllCommunityModule, type ColDef } from "ag-grid-community";

const gridModules = [AllCommunityModule];
import Sidebar from "@/components/Sidebar";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import { getTransactions } from "@/actions/transactions";
import {
  aggregateByCategory,
  getSummary,
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

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

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
      { field: "subCategory", headerName: "하위카테고리", sortable: true },
      { field: "card", headerName: "카드", sortable: true },
      { field: "payType", headerName: "구분", sortable: true, flex: 1, minWidth: 80 },
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

            <section className="flex flex-col lg:flex-row gap-8 items-start">
              <div
                className="rounded-xl border border-[var(--border)] p-6 flex flex-col items-center"
                style={{ background: "var(--card-bg)" }}
              >
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                  카테고리별 지출
                </h2>
                <BarChart key={`bar-${monthKey}`} data={chartData} animationKey={monthKey} />
              </div>
              <div
                className="rounded-xl border border-[var(--border)] p-6 flex flex-col items-center"
                style={{ background: "var(--card-bg)" }}
              >
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                  비율
                </h2>
                <DonutChart key={`donut-${monthKey}`} data={chartData} animationKey={monthKey} />
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
                  <div className="ag-theme-quartz min-w-[600px]" style={{ height: 320 }}>
                  <AgGridReact<TransactionRow>
                    theme="legacy"
                    rowData={transactions}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    domLayout="normal"
                    suppressCellFocus
                  />
                  </div>
                </div>
              </section>
            </AgGridProvider>
          </>
        )}
      </div>
    </div>
  );
}
