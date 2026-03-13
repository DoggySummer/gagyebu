"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { CATEGORIES } from "@/lib/mockData";

/** 목업: 폼 제출 시 /chart로 이동 (실제 저장 없음) */
export default function AddPage() {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push("/chart");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6 md:p-8">
        <h1 className="text-xl font-semibold mb-6 text-[var(--text)]">
          수동 지출 추가
        </h1>
        <form
          onSubmit={handleSubmit}
          className="max-w-md space-y-4 rounded-xl border border-[var(--border)] p-6"
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
              className="input-dark w-full rounded-lg px-4 py-2"
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
              className="input-dark w-full rounded-lg px-4 py-2"
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
              className="input-dark w-full rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm text-[var(--text-muted)] mb-1">
              카테고리
            </label>
            <select
              id="category"
              name="category"
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
            <label htmlFor="card" className="block text-sm text-[var(--text-muted)] mb-1">
              카드
            </label>
            <input
              id="card"
              name="card"
              type="text"
              defaultValue="마스터034"
              className="input-dark w-full rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label htmlFor="subCategory" className="block text-sm text-[var(--text-muted)] mb-1">
              세부 카테고리 (선택)
            </label>
            <input
              id="subCategory"
              name="subCategory"
              type="text"
              placeholder="예: 카페, 배달"
              className="input-dark w-full rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label htmlFor="payType" className="block text-sm text-[var(--text-muted)] mb-1">
              결제 구분
            </label>
            <select
              id="payType"
              name="payType"
              className="input-dark w-full rounded-lg px-4 py-2"
            >
              <option value="일시불">일시불</option>
              <option value="할부">할부</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn-primary w-full rounded-lg py-3 font-medium mt-4"
          >
            저장하기
          </button>
        </form>
      </div>
    </div>
  );
}
