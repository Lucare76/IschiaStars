"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ImportState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "done"; imported: number; skipped: number; needsReview: number }
  | { type: "error"; message: string };

export function PendingRequestsRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(() => formatTime(new Date()));
  const [importState, setImportState] = useState<ImportState>({ type: "idle" });

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

  const handleImport = useCallback(async () => {
    setImportState({ type: "loading" });
    try {
      const res = await fetch("/api/quote-requests/import-email", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setImportState({ type: "error", message: data.error ?? "Errore durante l'importazione" });
      } else {
        setImportState({
          type: "done",
          imported: data.imported ?? 0,
          skipped: data.skipped ?? 0,
          needsReview: data.needsReview ?? 0,
        });
        if ((data.imported ?? 0) > 0) refresh();
      }
    } catch {
      setImportState({ type: "error", message: "Errore di rete. Riprova." });
    }
  }, [refresh]);

  return (
    <div className="mb-5 rounded-2xl bg-white/90 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="font-semibold text-ischia-ink/70">Ultimo aggiornamento: {lastUpdated}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-ischia-navy/30 px-4 py-2 text-sm font-semibold text-ischia-navy disabled:opacity-60"
            disabled={importState.type === "loading"}
            onClick={handleImport}
            type="button"
          >
            {importState.type === "loading" ? "Controllo..." : "Controlla nuove richieste email"}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-ischia-navy px-4 py-2 font-black text-white disabled:opacity-60"
            disabled={isPending}
            onClick={refresh}
            type="button"
          >
            Aggiorna
          </button>
        </div>
      </div>
      {importState.type !== "idle" && (
        <div
          className={`border-t px-4 py-2 text-sm ${
            importState.type === "error" ? "text-red-600" : "text-ischia-ink/70"
          }`}
        >
          {importState.type === "loading" && "Connessione alla casella email in corso…"}
          {importState.type === "done" &&
            importState.imported > 0 &&
            `${importState.imported} nuove richieste importate${importState.needsReview > 0 ? `, ${importState.needsReview} da revisionare` : ""}.`}
          {importState.type === "done" &&
            importState.imported === 0 &&
            `Nessuna nuova richiesta.${importState.skipped > 0 ? ` ${importState.skipped} email già elaborate.` : ""}`}
          {importState.type === "error" && importState.message}
        </div>
      )}
    </div>
  );
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
