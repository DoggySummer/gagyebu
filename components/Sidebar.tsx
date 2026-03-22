"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLedgerOwnerStore } from "@/lib/stores/ledgerOwnerStore";

const NAV = [
  { href: "/chart", label: "차트" },
  { href: "/add", label: "내용추가" },
  { href: "/excel", label: "엑셀 추가하기" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ledgerOwner = useLedgerOwnerStore((s) => s.ledgerOwner);
  const setLedgerOwner = useLedgerOwnerStore((s) => s.setLedgerOwner);

  const navAndLogout = (
    <div className="flex flex-col pt-2">
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`sidebar-link rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              pathname === href
                ? "active"
                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-black/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div
        className="mt-4 pt-4 border-t border-[var(--border)]"
        role="group"
        aria-label="가계부 보기 대상"
      >
        <p className="px-1 mb-2 text-xs font-medium text-[var(--text-muted)]">보기</p>
        <div className="flex rounded-lg p-1 bg-black/[0.04] dark:bg-white/[0.06]">
          <button
            type="button"
            onClick={() => setLedgerOwner("appa")}
            className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors cursor-pointer ${
              ledgerOwner === "appa"
                ? "bg-[var(--card-bg)] text-[var(--text)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
            aria-pressed={ledgerOwner === "appa"}
          >
            아빠꺼
          </button>
          <button
            type="button"
            onClick={() => setLedgerOwner("gilwoong")}
            className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors cursor-pointer ${
              ledgerOwner === "gilwoong"
                ? "bg-[var(--card-bg)] text-[var(--text)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
            aria-pressed={ledgerOwner === "gilwoong"}
          >
            길웅이꺼
          </button>
        </div>
      </div>
      <div className="pt-4">
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            signOut({ callbackUrl: "/" });
          }}
          className="w-full rounded-lg px-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-black/5 transition-colors text-left cursor-pointer"
        >
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 모바일: 햄버거 버튼 (사이드바 닫혀 있을 때만 표시) */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="absolute z-[60] md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border)] transition-colors hover:bg-black/5 cursor-pointer"
          style={{
            position: "absolute",
            background: "var(--card-bg)",
            left: "max(1rem, env(safe-area-inset-left))",
            top: "max(1rem, env(safe-area-inset-top))",
          }}
          aria-label="메뉴 열기"
        >
          <svg className="w-5 h-5 text-[var(--text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* 모바일: 백드롭 */}
      <div
        role="presentation"
        className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-200"
        style={{
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? "auto" : "none",
        }}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* 사이드바: 모바일에서는 드로어, 데스크톱에서는 고정 너비 */}
      <aside
        className={`
          flex flex-col border-r border-[var(--border)] min-h-screen py-6 px-4
          fixed md:relative left-0 top-0 h-full z-50 w-64 md:w-52
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{
          background: "var(--card-bg)",
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        }}
      >
        {/* 모바일: 드로어 헤더(X 버튼) + 그 아래 여백 후 탭 */}
        <div className="flex-none flex items-center justify-end md:hidden min-h-12 pr-1">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] cursor-pointer"
            aria-label="메뉴 닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-none">
          {navAndLogout}
        </div>
      </aside>
    </>
  );
}
