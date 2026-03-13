"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 목업: 아무 비밀번호나 입력하면 /chart로 이동 */
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // 목업: 비밀번호가 비어 있지 않으면 통과
    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.");
      setLoading(false);
      return;
    }
    router.push("/chart");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] p-8 shadow-xl"
        style={{ background: "var(--card-bg)" }}
      >
        <h1 className="text-xl font-semibold text-center mb-6 text-[var(--accent)]">
          가계부
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm text-[var(--text-muted)] mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-dark w-full rounded-lg px-4 py-3"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full rounded-lg py-3 font-medium disabled:opacity-60"
          >
            {loading ? "..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
