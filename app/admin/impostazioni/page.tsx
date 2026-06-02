import { AdminShell } from "@/components/AdminShell";
import { PaymentSettingsForm } from "@/components/PaymentSettingsForm";
import { getPaymentSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const paymentSettings = await getPaymentSettings();

  return (
    <AdminShell title="Impostazioni" subtitle="Gestisci i dati operativi mostrati nei preventivi e nelle conferme.">
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
            I contatti restano gestiti nel codice; le coordinate pagamento qui sotto sono salvate nelle impostazioni operative.
          </p>
        </section>
      </div>
      <div className="mt-5">
        <PaymentSettingsForm initialSettings={paymentSettings.data} />
      </div>
    </AdminShell>
  );
}
