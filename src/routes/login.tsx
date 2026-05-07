import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { fetchAuthMe } from "#/lib/fetch-auth-me";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const res = await fetchAuthMe();
    const data = (await res.json()) as { authenticated?: boolean };
    if (data.authenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string };
        setError(j?.error ?? "登入失敗");
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setError("登入失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-wrap md:px-4 pb-10 pt-10">
      <section className="island-shell mx-auto max-w-md rounded-[2rem] p-6 sm:p-8">
        <h1 className="display-title m-0 text-2xl font-bold text-[var(--sea-ink)]">
          登入
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
          請輸入與伺服器設定相同的通行語（<code>APP_PASSPHRASE</code>）。
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error ? (
            <div className="rounded-xl border border-[var(--panel-muted-border)] bg-[var(--panel-muted-bg)] px-3 py-2 text-sm text-[var(--sea-ink-soft)]">
              {error}
            </div>
          ) : null}
          <label className="block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
            通行語
            <input
              type="text"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] shadow-[0_10px_30px_var(--shadow-soft)] outline-none focus:border-[var(--focus-ring)]"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl border border-[var(--border-cta)] bg-[var(--fill-cta-ghost)] px-4 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[var(--fill-cta-ghost-hover)] disabled:opacity-60"
          >
            {busy ? "登入中…" : "進入領域展開"}
          </button>
        </form>
      </section>
    </main>
  );
}
