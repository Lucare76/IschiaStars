"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { QuoteRequest } from "@/lib/types";

export function PendingRequestCard({ request }: { request: QuoteRequest }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await adminApiFetch(`/api/quote-requests/${request.id}`, {
      method: "DELETE",
      headers: adminApiHeaders(),
    });
    const data = await readAdminApiJson<{ ok?: boolean; error?: string }>(res);
    setDeleting(false);
    if (!res.ok || !data?.ok) {
      setError(adminApiErrorMessage(res, data, "Eliminazione non riuscita."));
      setConfirmDelete(false);
      return;
    }
    setDeleted(true);
    router.refresh();
  }

  if (deleted) return null;
  const showImportedAt = request.importedAt && request.importedAt !== request.receivedAt;

  return (
    <article className="min-w-0 rounded-2xl border border-white bg-white/86 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-ischia-navy">{request.firstName} {request.lastName}</h2>
          <p className="break-words text-sm text-ischia-ink/65">{request.email} - {request.phone}</p>
        </div>
        <QuoteStatusBadge status={request.status} />
      </div>

      <dl className="mt-5 grid gap-x-4 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-[0.75fr_1.15fr_1fr_1fr_0.55fr_1fr]">
        <Info label="Zona" value={request.destination} />
        <Info label="Hotel richiesto" value={request.requestedHotel ?? "Da definire"} />
        <Info label="Date" value={`${formatDate(request.arrivalDate)} - ${formatDate(request.departureDate)}`} numeric />
        <Info label="Ospiti" value={`${request.adults} adulti, ${request.children.length} bambini`} numeric />
        <Info label="Camere" value={`${request.rooms}`} numeric />
        <Info label="Trattamento" value={request.requestedTreatment ?? "Da definire"} />
      </dl>

      {request.children.length ? (
        <p className="mt-3 text-sm text-ischia-ink/70">
          Bambini: {request.children.map((child, i) =>
            child.age != null
              ? `Bambino ${i + 1}: ${child.age} ${child.age === 1 ? "anno" : "anni"}`
              : child.birthDate
                ? `${child.firstName} (${formatDate(child.birthDate)})`
                : `Bambino ${i + 1}`
          ).join(", ")}
        </p>
      ) : null}

      {request.message ? (
        <p className="mt-4 rounded-xl bg-ischia-mist p-4 text-sm text-ischia-ink/80">{request.message}</p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ischia-blue/10 pt-4 text-sm">
        <span className="text-ischia-ink/60">
          Ricevuta: {formatDateTime(request.receivedAt)}
          {showImportedAt ? ` - Importata: ${formatDateTime(request.importedAt!)}` : ""}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-sm font-semibold text-rose-700">Archiviare la richiesta?</span>
              <button
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                disabled={deleting}
                onClick={handleDelete}
                type="button"
              >
                {deleting ? "Archiviazione..." : "Sì, archivia"}
              </button>
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                type="button"
              >
                Annulla
              </button>
            </>
          ) : (
            <>
              <button
                className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-100"
                onClick={() => setConfirmDelete(true)}
                type="button"
              >
                Elimina
              </button>
              <Link
                className="rounded-full bg-ischia-sun px-4 py-2 font-bold text-ischia-navy"
                href={`/admin/preventivi/nuovo?requestId=${request.id}`}
              >
                Crea preventivo
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Info({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</dt>
      <dd className={`mt-1 break-words font-semibold leading-snug text-ischia-ink ${numeric ? "tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}
