import type { ReactNode } from "react";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { MobileFloatingWhatsApp, PublicQuoteHeaderActions } from "@/components/PublicQuoteActions";
import { PublicEventTracker } from "@/components/PublicEventTracker";
import { HesitantClientBanner } from "@/components/public/HesitantClientBanner";
import { CountdownBanner } from "@/components/public/CountdownBanner";
import { QuotePageWrapper } from "@/components/public/QuotePageWrapper";
import { QuoteProposalSection } from "@/components/QuoteProposalSection";
import { PrintButton } from "@/components/PrintButton";
import { Quote } from "@/lib/types";
import { formatClientName, formatDate } from "@/lib/utils";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { emptyFeatureFlags, FeatureFlags } from "@/lib/feature-flags";
import { ExtraServiceEmailItem } from "@/lib/extra-service-email-items";

export function PublicQuotePage({
  quote,
  hotelPopularity = {},
  showHesitantBanner = false,
  featureFlags = emptyFeatureFlags,
  travelServices = [],
  trackOpening = true
}: {
  quote: Quote;
  hotelPopularity?: Record<string, number>;
  showHesitantBanner?: boolean;
  featureFlags?: FeatureFlags;
  travelServices?: ExtraServiceEmailItem[];
  trackOpening?: boolean;
}) {
  const guests = `${quote.adults} adulti${quote.children.length ? `, ${quote.children.length} bambini` : ""}`;
  const options = getEffectiveHotelOptions(quote);
  const hasMultipleOptions = options.length > 1;

  return (
    <QuotePageWrapper customerFirstName={quote.customerFirstName} quoteCode={quote.code}>
    <main className="print-page mx-auto max-w-5xl px-5 py-6">
      {trackOpening ? <PublicEventTracker quoteCode={quote.code} token={quote.token} /> : null}

      <header className="no-print mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/90 p-4 shadow-soft">
        <IschiaStarsLogo />
        <PublicQuoteHeaderActions quote={quote} />
      </header>

      <section className="print-card overflow-hidden rounded-[28px] bg-white shadow-soft">
        {/* Intestazione brand */}
        <div className="brand-shell p-6 text-white sm:p-9">
          <IschiaStarsLogo light />
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.16em] text-ischia-sand">Preventivo {quote.code}</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
            {hasMultipleOptions ? "Le tue proposte di vacanza a Ischia" : "La tua proposta di vacanza a Ischia"}
          </h1>
          <p className="mt-4 max-w-xl text-white/84">
            Ciao {quote.customerFirstName},{" "}
            {hasMultipleOptions
              ? "abbiamo preparato più proposte per il tuo soggiorno a Ischia. Confronta le opzioni e conferma quella che preferisci."
              : "abbiamo preparato una proposta personalizzata per il tuo soggiorno."}
          </p>
        </div>

        {/* Info soggiorno */}
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">Dati soggiorno</p>
              <PublicQuoteStatusBadge quote={quote} />
            </div>
          </div>

          <InfoGrid
            items={[
              ["Cliente", formatClientName(quote.customerFirstName, quote.customerLastName)],
              ["Date", `${formatDate(quote.arrivalDate)} — ${formatDate(quote.departureDate)}`],
              ["Ospiti", guests],
              ["Camere", `${quote.rooms}`],
              ...(quote.isAlternative && quote.requestedHotel ? [["Struttura richiesta", quote.requestedHotel] as [string, string]] : [])
            ]}
          />

          <CountdownBanner offerExpiresAt={quote.offerExpiresAt} isConfirmed={quote.status === "confermato"} />

          {quote.isAlternative && quote.requestedHotel ? (
            <div className="mt-4 rounded-2xl bg-ischia-sun/15 p-4 text-sm font-semibold leading-6 text-ischia-navy ring-1 ring-ischia-sun/30">
              La struttura richiesta era {quote.requestedHotel}. Di seguito trovi la soluzione proposta disponibile per le date selezionate.
            </div>
          ) : null}

          {quote.children.length > 0 && (
            <div className="mt-4">
              <ContentBlock title="Bambini">
                <ul className="grid gap-2">
                  {quote.children.map((child, index) => (
                    <li key={child.id} className="rounded-xl bg-white p-3 ring-1 ring-ischia-blue/10">
                      Bambino {index + 1}:{" "}
                      {child.age != null
                        ? `${child.age} ${child.age === 1 ? "anno" : "anni"}`
                        : child.birthDate
                          ? `nato il ${formatDate(child.birthDate)}`
                          : "—"}
                    </li>
                  ))}
                </ul>
              </ContentBlock>
            </div>
          )}

          {quote.customerNotes && (
            <div className="mt-4">
              <ContentBlock title="Note per te">
                <p>{quote.customerNotes}</p>
              </ContentBlock>
            </div>
          )}

          {/* Azione stampa no-print */}
          <div className="no-print mt-5 flex justify-end">
            <PrintButton quoteCode={quote.code} token={quote.token} />
          </div>
        </div>
      </section>

      <HesitantClientBanner
        show={showHesitantBanner && quote.status !== "confermato" && featureFlags.alternative_proposal === true}
        quoteCode={quote.code}
        token={quote.token}
      />

      {/* Sezione interattiva: hotel cards + conferma */}
      <section className="mt-6">
        <div className="mb-4">
          <h2 className="text-3xl font-black text-ischia-navy">Le proposte selezionate per te</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ischia-ink/70">
            Confronta le soluzioni disponibili e conferma l&apos;opzione che preferisci.
          </p>
        </div>
        <QuoteProposalSection quote={quote} hotelPopularity={hotelPopularity} featureFlags={featureFlags} />
      </section>

      {travelServices.length > 0 ? (
        <section className="no-print mt-6 rounded-2xl bg-ischia-mist p-6 ring-1 ring-ischia-blue/15">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">Organizza anche il viaggio</p>
          <h2 className="mt-1 text-2xl font-black text-ischia-navy">Vuoi arrivare a Ischia senza pensieri?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ischia-ink/70">
            Oltre al soggiorno, possiamo aiutarti a scegliere il collegamento più comodo per raggiungere la struttura.
          </p>
          <div className="mt-4 divide-y divide-ischia-blue/10 rounded-2xl bg-white ring-1 ring-ischia-blue/10">
            {travelServices.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-ischia-blue">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-ischia-navy">{item.title}</p>
                    {item.description ? <p className="mt-0.5 text-xs text-ischia-ink/60">{item.description}</p> : null}
                  </div>
                </div>
                <p className="shrink-0 text-sm font-black text-ischia-navy">
                  da € {new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.priceFrom)}{" "}
                  <span className="text-xs font-normal text-ischia-ink/60">{item.priceSuffix}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ischia-ink/55">Le tariffe sono indicative e possono variare in base a data, disponibilità e orari.</p>
          <p className="mt-2 text-sm font-semibold text-ischia-navy">Rispondi a questa email o scrivici su WhatsApp: ti consiglieremo la soluzione più adatta al tuo viaggio.</p>
        </section>
      ) : null}

      <MobileFloatingWhatsApp quote={quote} />
    </main>
    </QuotePageWrapper>
  );
}

// Il cliente non deve vedere gli stati tecnici di backoffice (in_lavorazione, preventivo_inviato...):
// mostriamo solo l'esito che lo riguarda davvero.
function PublicQuoteStatusBadge({ quote }: { quote: Quote }) {
  if (quote.confirmation?.availabilityStatus === "availability_confirmed") {
    return <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Confermato</span>;
  }
  if (quote.confirmation) {
    return <span className="inline-flex rounded-full bg-ischia-sun/18 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">In attesa di conferma</span>;
  }
  return null;
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 rounded-2xl bg-ischia-mist p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">{label}</p>
          <p className="font-bold text-ischia-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ContentBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-ischia-blue/10">
      <h3 className="text-xl font-black text-ischia-navy">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-ischia-ink/78">{children}</div>
    </section>
  );
}
