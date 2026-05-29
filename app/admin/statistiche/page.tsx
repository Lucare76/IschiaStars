import { AdminShell } from "@/components/AdminShell";
import { StatsCards } from "@/components/StatsCards";
import { getDashboardStats } from "@/lib/repositories/stats";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const statsResult = await getDashboardStats();

  return (
    <AdminShell title="Statistiche" subtitle="Quando il cliente apre o conferma un preventivo, le metriche base si aggiornano.">
      <StatsCards stats={statsResult.data} />
    </AdminShell>
  );
}
