"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PendingRequestsRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(() => formatTime(new Date()));

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setLastUpdated(formatTime(new Date()));
    });
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm shadow-soft">
      <span className="font-semibold text-ischia-ink/70">Ultimo aggiornamento: {lastUpdated}</span>
      <button
        className="inline-flex items-center gap-2 rounded-full bg-ischia-navy px-4 py-2 font-black text-white disabled:opacity-60"
        disabled={isPending}
        onClick={refresh}
        type="button"
      >
        Aggiorna
      </button>
    </div>
  );
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
