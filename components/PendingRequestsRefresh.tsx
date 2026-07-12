"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminApiFetch } from "@/lib/admin-api-client";
import { useBackofficePolling } from "@/hooks/useBackofficePolling";

type ImportState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "done"; message: string }
  | { type: "error"; message: string };

type PollEmailResponse = {
  ok?: boolean;
  imported?: number;
  skipped?: number;
  duplicates?: number;
  ignored?: number;
  needsReview?: number;
  errors?: string[];
  message?: string;
  cooldownRemainingSeconds?: number;
  error?: string;
};

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

  useBackofficePolling(30_000);

  const handleImport = useCallback(async () => {
    setImportState({ type: "loading" });
    try {
      const res = await adminApiFetch("/api/admin/poll-email-now", { method: "POST" });
      const data = await res.json() as PollEmailResponse;
      if (!res.ok || !data.ok) {
        const errorMsg = data.message ?? data.error ?? data.errors?.[0] ?? "Errore durante l'importazione";
        setImportState({ type: "error", message: errorMsg });
      } else {
        setImportState({ type: "done", message: formatImportMessage(data) });
        refresh();
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
          {importState.type === "done" && importState.message}
          {importState.type === "error" && importState.message}
        </div>
      )}
    </div>
  );
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatImportMessage(data: PollEmailResponse) {
  const imported = data.imported ?? 0;
  const duplicates = data.duplicates ?? 0;
  const skipped = data.skipped ?? 0;
  const ignored = data.ignored ?? 0;
  const needsReview = data.needsReview ?? 0;
  const errors = data.errors?.length ?? 0;
  const parts = [
    `${imported} importate`,
    `${duplicates} duplicate`,
    `${skipped} saltate`,
    `${ignored} ignorate`,
    `${needsReview} da revisionare`
  ];
  const suffix = errors > 0 ? ` ${errors} errori.` : "";
  const reviewNote = needsReview > 0
    ? " Alcune email richiedono revisione e non compaiono nella lista Da evadere."
    : "";
  return `Controllo completato: ${parts.join(", ")}.${suffix}${reviewNote}`;
}
