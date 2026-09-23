import { AdminShell } from "@/components/AdminShell";
import { ExtraServiceEmailItemsEditor } from "@/components/ExtraServiceEmailItemsEditor";
import { listExtraServiceEmailItems } from "@/lib/repositories/extraServiceEmailItems";

export const dynamic = "force-dynamic";

export default async function ExtraServicesPage() {
  const result = await listExtraServiceEmailItems();

  return (
    <AdminShell title="Servizi extra" subtitle="Gestisci i collegamenti viaggio mostrati nella pagina preventivo e nelle email cliente.">
      <ExtraServiceEmailItemsEditor initialItems={result.data} />
    </AdminShell>
  );
}
