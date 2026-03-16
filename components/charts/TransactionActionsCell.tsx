"use client";

import type { ICellRendererParams } from "ag-grid-community";
import { motion } from "framer-motion";

interface RowData {
  id: number;
}

interface Context {
  onEdit?: (data: RowData) => void;
  onDelete?: (data: RowData) => void;
}

type Props = ICellRendererParams<RowData> & { context?: Context };

export default function TransactionActionsCell({ data, context }: Props) {
  if (!data?.id) return null;

  return (
    <div className="flex items-center gap-1 h-full">
      <motion.button
        type="button"
        whileTap={{ scale: 0.93 }}
        onClick={() => context?.onEdit?.(data)}
        className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] hover:bg-black/5 cursor-pointer"
        style={{ color: "var(--text)" }}
      >
        수정
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.93 }}
        onClick={() => context?.onDelete?.(data)}
        className="px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
      >
        삭제
      </motion.button>
    </div>
  );
}