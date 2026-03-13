"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import { getTransactions } from "@/actions/transactions";
import {
  aggregateByCategory,
  getSummary,
  type ChartDatum,
} from "@/lib/constants";

export default function ChartPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [chartData, setChartData] = useState<ChartDatum[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    count: 0,
    topCategory: "-",
  });
  const [loading, setLoading] = useState(true);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTransactions(monthKey).then((transactions) => {
      if (cancelled) return;
      const aggregated = aggregateByCategory(transactions);
      setChartData(aggregated);
      setSummary(
        getSummary(aggregated, transactions.length)
      );
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6 md:p-8">
        <header className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={prevMonth}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] p-2 rounded-lg hover:bg-black/5 transition-colors text-xl leading-none"
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
            className="text-[var(--text-muted)] hover:text-[var(--accent)] p-2 rounded-lg hover:bg-black/5 transition-colors text-xl leading-none"
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
          </>
        )}
      </div>
    </div>
  );
}
