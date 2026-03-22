"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useLedgerUserStore } from "@/lib/stores/ledgerUserStore";
import { getMonthlyReport, generateMonthlyReport } from "@/actions/report";

export default function ReportPage() {
  const ledgerUserId = useLedgerUserStore((s) => s.ledgerUserId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportBody, setReportBody] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    if (!generating) return;
    setElapsedSec(0);
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [generating]);

  useEffect(() => {
    let cancelled = false;
    setLoadingReport(true);
    setSuccessMsg(false);
    setErrorMessage(null);
    getMonthlyReport(monthKey, ledgerUserId).then((r) => {
      if (cancelled) return;
      setReportBody(r?.body ?? null);
      setLoadingReport(false);
    });
    return () => {
      cancelled = true;
    };
  }, [monthKey, ledgerUserId]);

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

  async function handleGenerate() {
    setErrorMessage(null);
    setSuccessMsg(false);
    setGenerating(true);
    const result = await generateMonthlyReport(monthKey, ledgerUserId);
    setGenerating(false);
    if (result.ok) {
      const r = await getMonthlyReport(monthKey, ledgerUserId);
      setReportBody(r?.body ?? null);
      setSuccessMsg(true);
    } else {
      setErrorMessage(result.error ?? "오류가 발생했습니다.");
    }
  }

  const showEmpty = !loadingReport && !reportBody;

  return (
    <div className="flex min-h-screen relative w-full">
      <Sidebar />
      <div className="flex-1 p-4 pt-14 pb-8 md:pt-6 md:p-8 min-w-0">
        <header className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={prevMonth}
            disabled={generating}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] p-2 rounded-lg hover:bg-black/5 transition-colors text-xl leading-none cursor-pointer disabled:opacity-40"
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
            disabled={generating}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] p-2 rounded-lg hover:bg-black/5 transition-colors text-xl leading-none cursor-pointer disabled:opacity-40"
            aria-label="다음 달"
          >
            ›
          </button>
        </header>

        <div
          className="w-full max-w-2xl rounded-xl border border-[var(--border)] p-4 sm:p-6"
          style={{ background: "var(--card-bg)" }}
        >
          {loadingReport ? (
            <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
          ) : showEmpty ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                이 달에 저장된 보고서가 없습니다. 버튼을 누르면 거래 데이터를
                바탕으로 AI 보고서를 만듭니다.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full max-w-md rounded-lg py-3 min-h-[48px] font-medium disabled:opacity-60"
              >
                {generating ? "작성 중..." : "보고서 작성하기"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed"
                style={{ wordBreak: "keep-all" }}
              >
                {reportBody}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full max-w-md rounded-lg py-3 min-h-[48px] font-medium disabled:opacity-60"
              >
                {generating ? "다시 작성 중..." : "다시 생성하기"}
              </button>
            </div>
          )}

          {generating && (
            <div className="mt-6 pt-4 space-y-3 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--text)]">
                걸린 시간: {elapsedSec}초
              </p>
              <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                <span
                  className="inline-block size-5 shrink-0 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"
                  aria-hidden
                />
                <span>로딩중...</span>
              </div>
            </div>
          )}

          {!generating && successMsg && (
            <p className="text-sm text-[var(--accent)] font-medium mt-4">
              보고서가 저장되었습니다.
            </p>
          )}

          {!generating && errorMessage && (
            <p className="text-sm text-red-600 mt-4">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
