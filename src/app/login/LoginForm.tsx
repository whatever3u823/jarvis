"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } else {
      setError((await res?.json().catch(() => null))?.error ?? "Could not sign in.");
      setPassword("");
    }
  };

  return (
    <form onSubmit={submit} className="mt-10">
      <label className="label mb-2 block" htmlFor="password">
        Password
      </label>
      <div className="flex border border-line-strong bg-panel transition-colors focus-within:border-brass-dim">
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-[15px] text-ivory outline-none"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="px-5 font-mono text-[11px] tracking-[0.14em] text-brass uppercase hover:text-brass-bright disabled:text-faint"
        >
          {busy ? "…" : "Enter ↵"}
        </button>
      </div>
      {error && <p className="mt-3 font-mono text-[11px] text-rust">{error}</p>}
    </form>
  );
}
