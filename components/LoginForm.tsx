"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setLoading(false);

    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? "Accesso non riuscito.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  async function requestPasswordReset(email: string) {
    setError(null);
    setResetMessage(null);
    setResetLoading(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setResetLoading(false);

    if (!response.ok || !payload?.ok) {
      setError(payload?.error ?? "Non siamo riusciti a inviare il recupero password.");
      return;
    }

    setResetMessage(payload.message ?? "Controlla la tua email per reimpostare la password.");
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 ring-1 ring-rose-100">{error}</p> : null}
      {resetMessage ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{resetMessage}</p> : null}
      <label className="block text-sm font-semibold text-ischia-ink">
        Email
        <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-4 py-3" name="email" required type="email" autoComplete="email" />
      </label>
      <label className="block text-sm font-semibold text-ischia-ink">
        Password
        <span className="relative mt-1 block">
          <input className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 pr-12" name="password" required type={showPassword ? "text" : "password"} autoComplete="current-password" />
          <button
            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-ischia-blue transition hover:bg-ischia-mist"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            <EyeIcon hidden={showPassword} />
          </button>
        </span>
      </label>
      <button className="w-full rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60" disabled={loading} type="submit">
        {loading ? "Accesso..." : "Accedi"}
      </button>
      <div className="text-center">
        <button className="text-sm font-bold text-ischia-blue hover:text-ischia-navy" onClick={() => setShowReset((current) => !current)} type="button">
          Password dimenticata?
        </button>
      </div>
      {showReset ? <PasswordResetBox loading={resetLoading} onSubmit={requestPasswordReset} /> : null}
    </form>
  );
}

function PasswordResetBox({ loading, onSubmit }: { loading: boolean; onSubmit: (email: string) => void }) {
  return (
    <div className="rounded-2xl bg-ischia-mist p-4">
      <p className="text-sm font-semibold text-ischia-ink/75">Inserisci l&apos;email operatore e riceverai il link per impostare una nuova password.</p>
      <label className="mt-3 block text-sm font-semibold text-ischia-ink">
        Email
        <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-4 py-3" name="resetEmail" type="email" autoComplete="email" />
      </label>
      <button
        className="mt-3 w-full rounded-full bg-white px-5 py-3 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
        disabled={loading}
        onClick={(event) => {
          const form = event.currentTarget.closest("form");
          const email = form ? String(new FormData(form).get("resetEmail") ?? "") : "";
          if (email) onSubmit(email);
        }}
        type="button"
      >
        {loading ? "Invio..." : "Invia link di reset"}
      </button>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m3 3 18 18" />
      <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" />
      <path d="M9.88 4.24A10.8 10.8 0 0 1 12 4c5 0 9 5 10 8a13.2 13.2 0 0 1-2.38 3.91" />
      <path d="M6.1 6.1C4.03 7.48 2.65 9.65 2 12c1 3 5 8 10 8a10.8 10.8 0 0 0 4.25-.9" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
