"use client";

import { type SubmitEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, from }),
    });

    const data = (await res.json()) as { ok: boolean; error?: string; redirectTo?: string };
    setIsLoading(false);

    if (!data.ok) {
      setError(data.error ?? "Incorrect password.");
      return;
    }

    window.location.href = data.redirectTo ?? "/";
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(49,57,70,0.96),rgba(31,37,46,0.94))] px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.28em] uppercase text-[var(--text-muted)]">
          Mise-en-Lens
        </p>
        <h1 className="font-serif text-3xl">Enter password</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="h-12 w-full rounded-[1.1rem] border border-white/12 bg-white/6 px-4 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:bg-white/8"
        />
        {error ? (
          <p className="text-sm text-[#ffd9b8]">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={isLoading || !password}
          className="h-12 w-full rounded-[1.1rem] bg-[var(--accent-orange)] text-sm font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Checking..." : "Continue"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-white">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
