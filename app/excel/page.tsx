"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { processExcelAndSave } from "@/actions/processExcel";
import { useLedgerUserStore } from "@/lib/stores/ledgerUserStore";

/** 엑셀 업로드 → Claude 프롬프트 해석 → JSON → MySQL 저장 */
export default function ExcelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ledgerUserId = useLedgerUserStore((s) => s.ledgerUserId);

  useEffect(() => {
    if (!saving) return;
    setElapsedSec(0);
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [saving]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setSuccessCount(null);
    setErrorMessage(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrorMessage("엑셀 파일을 선택해 주세요.");
      setSuccessCount(null);
      return;
    }
    setErrorMessage(null);
    setSuccessCount(null);
    setSaving(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await processExcelAndSave(formData, ledgerUserId);
    setSaving(false);
    if (result.ok) {
      if (result.parsedJson) {
        console.log("[Claude 파싱 JSON]", result.parsedJson);
      }
      setSuccessCount(result.count ?? 0);
      setFile(null);
      const input = document.getElementById("excel-file") as HTMLInputElement;
      if (input) input.value = "";
    } else {
      const errMsg = result.error ?? String(result);
      console.error(
        "[엑셀 저장 오류] 아래 객체를 펼치면 전체 메시지를 볼 수 있습니다.",
        { error: errMsg },
      );
      setErrorMessage("오류가 발생했습니다.");
    }
  }

  return (
    <div className="flex min-h-screen relative w-full">
      <Sidebar />
      <div className="flex-1 p-4 pt-14 pb-8 md:pt-6 md:p-8 min-w-0">
        <h1 className="text-xl font-semibold mb-6 text-[var(--text)]">
          엑셀 추가하기
        </h1>
        <div
          className="w-full max-w-md rounded-xl border border-[var(--border)] p-4 sm:p-6"
          style={{ background: "var(--card-bg)" }}
        >
          <p className="text-sm text-[var(--text-muted)] mb-4">
            카드사에서 받은 엑셀 파일을 선택한 뒤 저장하기를 눌러 주세요.
          </p>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="excel-file"
                className="block text-sm text-[var(--text-muted)] mb-2"
              >
                엑셀 파일
              </label>
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="input-dark w-full rounded-lg px-4 py-3 min-h-[44px] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:text-white file:font-medium file:cursor-pointer file:min-h-[40px]"
              />
              {file && (
                <p className="mt-2 text-sm text-[var(--accent)]">
                  선택됨: {file.name}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full rounded-lg py-3 min-h-[48px] font-medium disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>

            {saving && (
              <div className="pt-2 space-y-3 border-t border-[var(--border)]">
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

            {!saving && successCount !== null && (
              <p className="text-sm text-[var(--accent)] font-medium pt-1">
                저장되었습니다! 총 데이터 : {successCount}개
              </p>
            )}

            {!saving && errorMessage && (
              <p className="text-sm text-red-600 pt-1">{errorMessage}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
