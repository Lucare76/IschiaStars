import { AdminShell } from "@/components/AdminShell";
import { FollowUpSettingsForm } from "@/components/FollowUpSettingsForm";
import { PaymentSettingsForm } from "@/components/PaymentSettingsForm";
import { QuoteChipSettingsForm } from "@/components/QuoteChipSettingsForm";
import { getFollowUpSettings } from "@/lib/repositories/followUpSettings";
import { getPaymentSettings, getQuoteChipSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [paymentSettings, quoteChipSettings, followUpSettings] = await Promise.all([
    getPaymentSettings(),
    getQuoteChipSettings(),
    getFollowUpSettings()
  ]);

  return (
    <AdminShell title="Impostazioni" subtitle="Gestisci i dati operativi mostrati nei preventivi, nelle conferme e nei follow-up.">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Contatti IschiaStars</h2>
          <label className="mt-4 block text-sm font-semibold">Telefono<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" defaultValue="081 90 54 81" /></label>
          <label className="mt-3 block text-sm font-semibold">WhatsApp<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" defaultValue="371 75 90 017" /></label>
          <label className="mt-3 block text-sm font-semibold">Email<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" defaultValue="info@ischiastars.it" /></label>
        </section>
        <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Autonomia operativa</h2>
          <p className="mt-2 text-sm leading-6 text-ischia-ink/72">
            Qui concentriamo progressivamente tutto ciò che Diego deve poter modificare senza interventi sul codice: testi commerciali, categorie camere, coordinate di pagamento, contatti e regole operative semplici.
          </p>
        </section>
      </div>
      <div className="mt-5">
        <FollowUpSettingsForm initialSettings={followUpSettings.data} />
      </div>
      <div className="mt-5">
        <QuoteChipSettingsForm initialSettings={quoteChipSettings.data} />
      </div>
      <div className="mt-5">
        <PaymentSettingsForm initialSettings={paymentSettings.data} />
      </div>
    </AdminShell>
  );
}
