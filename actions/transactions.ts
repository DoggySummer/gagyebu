"use server";

import { prisma } from "@/lib/prisma";
import { requireLedgerUserId } from "@/lib/ledgerUser";
import { revalidatePath } from "next/cache";

import type { Transaction } from "@prisma/client";

export type LedgerTransactionRow = Transaction;

/** 월별 거래 조회 (YYYY-MM) — userId별 transactions */
export async function getTransactions(
  month: string | undefined,
  userId: number,
): Promise<Transaction[]> {
  const uid = requireLedgerUserId(userId);
  if (!month) {
    return prisma.transaction.findMany({
      where: { userId: uid },
      orderBy: { date: "desc" },
    });
  }
  const start = new Date(`${month}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return prisma.transaction.findMany({
    where: { userId: uid, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
}

/** 수동 항목 추가 */
export async function addTransaction(
  formData: FormData,
  userId: number,
) {
  const uid = requireLedgerUserId(userId);
  await prisma.transaction.create({
    data: {
      userId: uid,
      date: new Date(formData.get("date") as string),
      card: (formData.get("card") as string) || "마스터034",
      payType: (formData.get("payType") as string) ?? "일시불",
      merchant: formData.get("merchant") as string,
      amount: Number(formData.get("amount")),
      category: formData.get("category") as string,
      sourceFile: "manual",
    },
  });
  revalidatePath("/chart");
}

/** 항목 수정 (가맹점, 금액, 카테고리) */
export async function updateTransaction(
  id: number,
  data: { merchant: string; amount: number; category: string | null },
  userId: number,
) {
  const uid = requireLedgerUserId(userId);
  await prisma.transaction.update({
    where: { id, userId: uid },
    data: {
      merchant: data.merchant,
      amount: data.amount,
      category: data.category,
    },
  });
  revalidatePath("/chart");
}

/** 항목 삭제 */
export async function deleteTransaction(id: number, userId: number) {
  const uid = requireLedgerUserId(userId);
  await prisma.transaction.delete({
    where: { id, userId: uid },
  });
  revalidatePath("/chart");
}
