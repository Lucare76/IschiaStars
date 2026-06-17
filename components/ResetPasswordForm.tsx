"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Recupero password non disponibile.");
      return;
    }

    async function prepareSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      let sessionOk = false;
      if (code) {
        const { error: exchangeError } = await supabase!.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("Link di reset non valido o scaduto. Richiedi un nuovo link.");
        } else {
          sessionOk = true;
        }
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessionError) {
          setError("Link di reset non valido o scaduto. Richiedi un nuovo link.");
        } else {
          sessionOk = true;
        }
      } else {
        setError("Link di reset mancante o già utilizzato. Richiedi un nuovo link.");
      }

      window.history.replaceState({}, "", "/reset-password");
      if (sessionOk) setReady(true);
    }

    void prepareSession();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Recupero password non disponibile.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    await supabase.auth.signOut();
    setLoading(false);

    if (updateError) {
      setError("Non siamo riusciti ad aggiornare la password. Richiedi un nuovo link.");
      return;
    }

    setMessage("Password aggiornata. Puoi accedere con le nuove credenziali.");
    setTimeout(() => router.push("/login"), 1400);
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 ring-1 ring-rose-100">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{message}</p> : null}
      <PasswordField label="Nuova password" name="password" show={showPassword} toggle={() => setShowPassword((current) => !current)} />
      <PasswordField label="Conferma password" name="confirmPassword" show={showConfirm} toggle={() => setShowConfirm((current) => !current)} />
      <button className="w-full rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60" disabled={!ready || loading} type="submit">
        {loading ? "Aggiornamento..." : "Aggiorna password"}
      </button>
    </form>
  );
}

function PasswordField({ label, name, show, toggle }: { label: string; name: string; show: boolean; toggle: () => void }) {
  return (
    <label className="block text-sm font-semibold text-ischia-ink">
      {label}
      <span className="relative mt-1 block">
        <input className="w-full rounded-xl border border-ischia-blue/20 px-4 py-3 pr-12" name={name} required type={show ? "text" : "password"} autoComplete="new-password" />
        <button aria-label={show ? "Nascondi password" : "Mostra password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-ischia-blue transition hover:bg-ischia-mist" onClick={toggle} type="button">
          <EyeIcon hidden={show} />
        </button>
      </span>
    </label>
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
