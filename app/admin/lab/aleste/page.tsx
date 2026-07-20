import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { getAdminSession } from "@/lib/server/auth-guard";
import { isAlestePublicTestEnabled } from "@/lib/integrations/aleste-public";
import { TestAlesteClient } from "./TestAlesteClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function LabAlestePage() {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    redirect("/admin");
  }

  if (!isAlestePublicTestEnabled()) {
    return (
      <AdminShell title="Test booking Aleste" subtitle="Laboratorio tecnico isolato per il booking engine pubblico.">
        <section className="rounded-2xl bg-white/90 p-6 text-sm font-semibold text-ischia-ink/70 shadow-soft">
          <p className="text-base font-black text-ischia-navy">Test non disponibile</p>
          <p className="mt-2">La feature flag ALESTE_PUBLIC_TEST_ENABLED non è attiva.</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Test booking Aleste" subtitle="Laboratorio tecnico isolato: nessun dato viene salvato o mostrato ai clienti.">
      <TestAlesteClient />
    </AdminShell>
  );
}
