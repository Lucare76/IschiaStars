"use client";

import type { EmailLog } from "@/lib/repositories/emailLogs";

const EMAIL_TYPE_LABELS: Record<string, string> = {
  quote_to_client: "Preventivo",
  confirmation_internal: "Conferma interna",
  final_confirmation_to_client: "Conferma definitiva",
  voucher_to_client: "Voucher",
  supplier_confirmation: "Conferma fornitore",
  unavailability_to_client: "Indisponibilità",
};

function statusBadge(log: EmailLog) {
  if (log.status === "failed" || log.status === "hard_bounce" || log.status === "blocked") {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{statusLabel(log.status)}</span>;
  }
  if (log.status === "soft_bounce" || log.status === "error" || log.status === "deferred") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{statusLabel(log.status)}</span>;
  }
  if (log.status === "clicked") {
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">Link cliccato</span>;
  }
  if (log.status === "opened") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Aperta</span>;
  }
  if (log.status === "delivered") {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">Consegnata</span>;
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">Inviata</span>;
}

function statusLabel(status: string): string {
  switch (status) {
    case "sent": return "Inviata";
    case "failed": return "Errore invio";
    case "delivered": return "Consegnata";
    case "opened": return "Aperta";
    case "clicked": return "Link cliccato";
    case "soft_bounce": return "Soft bounce";
    case "hard_bounce": return "Hard bounce";
    case "blocked": return "Bloccata";
    case "error": return "Errore";
    case "deferred": return "In coda";
    default: return status;
  }
}

function progressDots(log: EmailLog) {
  const steps = [
    { key: "sent", done: log.sentAt != null },
    { key: "delivered", done: log.deliveredAt != null },
    { key: "opened", done: log.openedAt != null },
    { key: "clicked", done: log.clickedAt != null },
  ];
  const isBounced = ["soft_bounce", "hard_bounce", "blocked", "failed", "error"].includes(log.status);

  return (
    <span className="inline-flex items-center gap-0.5">
      {steps.map((step) => (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            isBounced ? "bg-rose-300" : step.done ? "bg-emerald-400" : "bg-gray-200"
          }`}
          key={step.key}
          title={step.key}
        />
      ))}
    </span>
  );
}

export function EmailTrackingStatus({ emailLogs }: { emailLogs: EmailLog[] }) {
  if (!emailLogs.length) return null;

  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-soft ring-1 ring-ischia-blue/10">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Stato email Brevo</p>
      <div className="mt-3 space-y-2">
        {emailLogs.map((log) => (
          <div className="flex items-center gap-2 text-xs" key={log.id}>
            <span className="min-w-[100px] font-semibold text-ischia-ink/70">{EMAIL_TYPE_LABELS[log.emailType] ?? log.emailType}</span>
            {progressDots(log)}
            {statusBadge(log)}
            {log.errorMessage ? <span className="truncate text-rose-600" title={log.errorMessage}>{log.errorMessage.slice(0, 40)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
