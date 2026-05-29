import { AdminShell } from "@/components/AdminShell";

export default function ServicesPolicyPage() {
  return (
    <AdminShell title="Servizi inclusi e policy" subtitle="Funzione futura non inclusa nel flusso operativo attuale.">
      <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-black text-ischia-navy">Gestione tramite hotel</h2>
        <p className="mt-2 text-sm text-ischia-ink/70">
          Per la versione operativa i servizi inclusi, la policy pagamento e la policy cancellazione si modificano dalla scheda Hotel / strutture.
        </p>
      </div>
    </AdminShell>
  );
}
