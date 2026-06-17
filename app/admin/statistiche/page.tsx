import { AdminShell } from "@/components/AdminShell";
import { StatsCards } from "@/components/StatsCards";
import { getDashboardStats } from "@/lib/repositories/stats";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const statsResult = await getDashboardStats();

  return (
    <AdminShell title="Statistiche" subtitle="Quando il cliente apre o conferma un preventivo, le metriche base si aggiornano.">
      {statsResult.source === "supabase" ? <StatsCards stats={statsResult.data} /> : <DataUnavailable error={statsResult.error} />}
    </AdminShell>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Statistiche non disponibili</p>
      <p className="mt-2">
        Connessione al database non riuscita. Per evitare numeri demo o dati non reali, le statistiche restano nascoste finché Supabase non risponde correttamente.
      </p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
  );
}
