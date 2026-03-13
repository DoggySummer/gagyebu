"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { AgGridReact, AgGridProvider } from "ag-grid-react";
import { AllCommunityModule, type ColDef } from "ag-grid-community";

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
    subCategory: "",
  });

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

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
      { field: "subCategory", headerName: "하위카테고리", sortable: true },
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
                    context={{
                      onEdit: (data: { id: number }) => {
                        const row = transactions.find((t) => t.id === data.id);
                        if (row) {
                          setEditingRow(row);
                          setEditForm({
                            merchant: row.merchant,
                            amount: row.amount,
                            category: row.category ?? "",
                            subCategory: row.subCategory ?? "",
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
                        subCategory: editForm.subCategory || null,
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
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-1">하위 카테고리</label>
                      <input
                        type="text"
                        value={editForm.subCategory}
                        onChange={(e) => setEditForm((f) => ({ ...f, subCategory: e.target.value }))}
                        className="input-dark w-full rounded-lg px-4 py-2"
                        placeholder="선택"
                      />
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
