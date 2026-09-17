import { AdminShell } from "@/components/AdminShell";
import { BusinessContactSettingsForm } from "@/components/BusinessContactSettingsForm";
import { FollowUpRuleSettingsForm } from "@/components/FollowUpRuleSettingsForm";
import { FollowUpSettingsForm } from "@/components/FollowUpSettingsForm";
import { PaymentSettingsForm } from "@/components/PaymentSettingsForm";
import { QuoteChipSettingsForm } from "@/components/QuoteChipSettingsForm";
import { QuoteContentSettingsForm } from "@/components/QuoteContentSettingsForm";
import { getBusinessContactSettings } from "@/lib/repositories/businessContactSettings";
import { getFollowUpRuleSettings } from "@/lib/repositories/followUpRuleSettings";
import { getFollowUpSettings } from "@/lib/repositories/followUpSettings";
import { getQuoteContentSettings } from "@/lib/repositories/quoteContentSettings";
import { getPaymentSettings, getQuoteChipSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [paymentSettings, quoteChipSettings, followUpSettings, businessContacts, followUpRules, quoteContentSettings] = await Promise.all([
    getPaymentSettings(),
    getQuoteChipSettings(),
    getFollowUpSettings(),
    getBusinessContactSettings(),
    getFollowUpRuleSettings(),
    getQuoteContentSettings()
  ]);

  return (
    <AdminShell title="Impostazioni" subtitle="Gestisci i dati operativi mostrati nei preventivi, nelle conferme e nei follow-up.">
      <div className="grid gap-5 lg:grid-cols-2">
        <BusinessContactSettingsForm initialSettings={businessContacts.data} />
        <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-black text-ischia-navy">Autonomia operativa</h2>
          <p className="mt-2 text-sm leading-6 text-ischia-ink/72">
            Qui concentriamo progressivamente tutto ciò che Diego deve poter modificare senza interventi sul codice: testi commerciali, categorie camere, coordinate di pagamento, contatti e regole operative semplici.
          </p>
        </section>
      </div>
      <div className="mt-5">
        <QuoteContentSettingsForm initialSettings={quoteContentSettings.data} />
      </div>
      <div className="mt-5">
        <FollowUpSettingsForm initialSettings={followUpSettings.data} />
      </div>
      <div className="mt-5">
        <FollowUpRuleSettingsForm initialSettings={followUpRules.data} />
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
