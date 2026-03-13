"use client";

import type { ICellRendererParams } from "ag-grid-community";

type Context = {
  onEdit?: (data: { id: number }) => void;
  onDelete?: (data: { id: number }) => void;
};

export default function TransactionActionsCell(
  params: ICellRendererParams & { context?: Context }
) {
  const data = params.data as { id: number } | undefined;
  const ctx = params.context as Context | undefined;
  if (!data?.id) return null;

  return (
    <div className="flex items-center gap-1 h-full">
      <button
        type="button"
        onClick={() => ctx?.onEdit?.(data)}
        className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] hover:bg-black/5 cursor-pointer"
        style={{ color: "var(--text)" }}
      >
        수정
      </button>
      <button
        type="button"
        onClick={() => ctx?.onDelete?.(data)}
        className="px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
      >
        삭제
      </button>
    </div>
  );
}
