"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/chart", label: "차트" },
  { href: "/add", label: "내용추가" },
  { href: "/excel", label: "엑셀 추가하기" },
];

/** 목업: 로그아웃 시 / 로 이동 */
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    router.push("/");
  }

  return (
    <aside
      className="w-52 flex flex-col border-r border-[var(--border)] min-h-screen py-6 px-4"
      style={{ background: "var(--card-bg)" }}
    >
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              pathname === href ? "active" : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-black/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg px-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-black/5 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
