import { AdminShell } from "@/components/AdminShell";

export default function SettingsPage() {
  return (
    <AdminShell title="Impostazioni" subtitle="Funzione futura non inclusa nel flusso operativo attuale.">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Contatti IschiaStars</h2>
          <label className="mt-4 block text-sm font-semibold">Telefono<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" defaultValue="081 90 54 81" /></label>
          <label className="mt-3 block text-sm font-semibold">WhatsApp<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" defaultValue="371 75 90 017" /></label>
          <label className="mt-3 block text-sm font-semibold">Email<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" defaultValue="info@ischiastars.it" /></label>
        </section>
        <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Da completare in produzione</h2>
          <p className="mt-2 text-sm leading-6 text-ischia-ink/72">
            Questa sezione non fa parte del flusso operativo attuale: per ora i contatti sono gestiti nel codice e il menu principale usa solo le funzioni pronte.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
