import { AdminShell } from "@/components/AdminShell";
import { ExtraServiceEmailItemsEditor } from "@/components/ExtraServiceEmailItemsEditor";
import { listExtraServiceEmailItems } from "@/lib/repositories/extraServiceEmailItems";

export const dynamic = "force-dynamic";

export default async function ExtraServicesPage() {
  const result = await listExtraServiceEmailItems();

  return (
    <AdminShell title="Servizi extra" subtitle="Gestisci le voci commerciali dei collegamenti mostrate in fondo alle email preventivo.">
      <ExtraServiceEmailItemsEditor initialItems={result.data} />
    </AdminShell>
  );
}
