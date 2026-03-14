"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { addTransaction } from "@/actions/transactions";
import { CATEGORIES } from "@/lib/constants";

export default function AddPage() {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    await addTransaction(formData);
    router.push("/chart");
  }

  return (
    <div className="flex min-h-screen relative w-full md:max-w-[80vw] md:mx-auto">
      <Sidebar />
      <div className="flex-1 p-4 pt-14 pb-8 md:pt-6 md:p-8 min-w-0">
        <h1 className="text-xl font-semibold mb-6 text-[var(--text)]">
          수동 지출 추가
        </h1>
        <form
          action={handleSubmit}
          className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] p-4 sm:p-6"
          style={{ background: "var(--card-bg)" }}
        >
          <div>
            <label htmlFor="date" className="block text-sm text-[var(--text-muted)] mb-1">
              날짜
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="merchant" className="block text-sm text-[var(--text-muted)] mb-1">
              가맹점
            </label>
            <input
              id="merchant"
              name="merchant"
              type="text"
              required
              placeholder="가맹점명"
              className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm text-[var(--text-muted)] mb-1">
              금액 (원)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              required
              min={1}
              placeholder="0"
              className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm text-[var(--text-muted)] mb-1">
              카테고리
            </label>
            <select
              id="category"
              name="category"
              className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="card" className="block text-sm text-[var(--text-muted)] mb-1">
              카드
            </label>
            <input
              id="card"
              name="card"
              type="text"
              defaultValue="마스터034"
              className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="payType" className="block text-sm text-[var(--text-muted)] mb-1">
              결제 구분
            </label>
            <select
              id="payType"
              name="payType"
              className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px]"
            >
              <option value="일시불">일시불</option>
              <option value="할부">할부</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn-primary w-full rounded-lg py-3 min-h-[48px] font-medium mt-4"
          >
            저장하기
          </button>
        </form>
      </div>
    </div>
  );
}
