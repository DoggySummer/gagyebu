"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

/** 엑셀 파일 선택 후 저장하기 클릭 시 alert('저장되었습니다!') */
export default function ExcelPage() {
  const [file, setFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f ?? null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      alert("엑셀 파일을 선택해 주세요.");
      return;
    }
    alert("저장되었습니다!");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6 md:p-8">
        <h1 className="text-xl font-semibold mb-6 text-[var(--text)]">
          엑셀 추가하기
        </h1>
        <div
          className="max-w-md rounded-xl border border-[var(--border)] p-6"
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
                className="input-dark w-full rounded-lg px-4 py-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:text-white file:font-medium file:cursor-pointer"
              />
              {file && (
                <p className="mt-2 text-sm text-[var(--accent)]">
                  선택됨: {file.name}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary w-full rounded-lg py-3 font-medium"
            >
              저장하기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
