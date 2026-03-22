"use server";

import { prisma } from "@/lib/prisma";
import type { LedgerOwner } from "@/lib/ledgerOwner";
import { revalidatePath } from "next/cache";

import type { Transaction, MyTransaction } from "@prisma/client";

export type LedgerTransactionRow = Transaction | MyTransaction;

/** 월별 거래 조회 (YYYY-MM 형식) — 아빠꺼: transactions, 길웅이꺼: mytransactions */
export async function getTransactions(
  month: string | undefined,
  owner: LedgerOwner
): Promise<LedgerTransactionRow[]> {
  if (owner === "gilwoong") {
    if (!month) {
      return prisma.myTransaction.findMany({ orderBy: { date: "desc" } });
    }
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return prisma.myTransaction.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
  }

  if (!month) {
    return prisma.transaction.findMany({ orderBy: { date: "desc" } });
  }
  const start = new Date(`${month}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
}

/** 수동 항목 추가 */
export async function addTransaction(
  formData: FormData,
  owner: LedgerOwner
) {
  const data = {
    date: new Date(formData.get("date") as string),
    card: (formData.get("card") as string) || "마스터034",
    payType: (formData.get("payType") as string) ?? "일시불",
    merchant: formData.get("merchant") as string,
    amount: Number(formData.get("amount")),
    category: formData.get("category") as string,
    sourceFile: "manual",
  };
  if (owner === "gilwoong") {
    await prisma.myTransaction.create({ data });
  } else {
    await prisma.transaction.create({ data });
  }
  revalidatePath("/chart");
}

/** 항목 수정 (가맹점, 금액, 카테고리) */
export async function updateTransaction(
  id: number,
  data: { merchant: string; amount: number; category: string | null },
  owner: LedgerOwner
) {
  const payload = {
    merchant: data.merchant,
    amount: data.amount,
    category: data.category,
  };
  if (owner === "gilwoong") {
    await prisma.myTransaction.update({ where: { id }, data: payload });
  } else {
    await prisma.transaction.update({ where: { id }, data: payload });
  }
  revalidatePath("/chart");
}

/** 항목 삭제 */
export async function deleteTransaction(id: number, owner: LedgerOwner) {
  if (owner === "gilwoong") {
    await prisma.myTransaction.delete({ where: { id } });
  } else {
    await prisma.transaction.delete({ where: { id } });
  }
  revalidatePath("/chart");
}
