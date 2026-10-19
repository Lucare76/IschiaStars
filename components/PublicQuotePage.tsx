import type { ReactNode } from "react";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { MobileFloatingWhatsApp, PublicQuoteHeaderActions } from "@/components/PublicQuoteActions";
import { PublicEventTracker } from "@/components/PublicEventTracker";
import { HesitantClientBanner } from "@/components/public/HesitantClientBanner";
import { CountdownBanner } from "@/components/public/CountdownBanner";
import { QuotePageWrapper } from "@/components/public/QuotePageWrapper";
import { QuoteProposalSection } from "@/components/QuoteProposalSection";
import { PrintButton } from "@/components/PrintButton";
import type { PublicQuoteDTO } from "@/lib/public-quote-dto";
import { formatClientName, formatDate } from "@/lib/utils";
import { emptyFeatureFlags, FeatureFlags } from "@/lib/feature-flags";
import type { ExtraServiceEmailItem } from "@/lib/extra-service-email-items";
import { defaultQuoteContentSettings, type QuoteContentSettings } from "@/lib/quote-content-settings";

export function PublicQuotePage({
  quote,
  hotelPopularity = {},
  showHesitantBanner = false,
  featureFlags = emptyFeatureFlags,
  travelServices = [],
  trackOpening = true,
  openingSource,
  contentSettings = defaultQuoteContentSettings
}: {
  quote: PublicQuoteDTO;
  hotelPopularity?: Record<string, number>;
  showHesitantBanner?: boolean;
  featureFlags?: FeatureFlags;
  travelServices?: ExtraServiceEmailItem[];
  trackOpening?: boolean;
  openingSource?: string;
  contentSettings?: QuoteContentSettings;
}) {
  const guests = `${quote.adults} adulti${quote.children.length ? `, ${quote.children.length} bambini` : ""}`;
  const options = quote.hotelOptions;
  const hasMultipleOptions = options.length > 1;

  return (
    <QuotePageWrapper>
    <main className="print-page mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
      {trackOpening ? <PublicEventTracker quoteCode={quote.code} token={quote.token} source={openingSource} /> : null}

      <header className="no-print mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/95 px-4 py-3 shadow-soft ring-1 ring-ischia-blue/10">
        <IschiaStarsLogo />
        <PublicQuoteHeaderActions quote={quote} contentSettings={contentSettings} />
      </header>

      <section className="print-card overflow-hidden rounded-[30px] bg-white shadow-soft ring-1 ring-ischia-blue/10">
        <div className="brand-shell p-6 text-white sm:p-8">
          <IschiaStarsLogo light />
          <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-ischia-sand sm:mt-8">Preventivo {quote.code}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
            {hasMultipleOptions ? contentSettings.multipleHeroTitle : contentSettings.singleHeroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/88">
            Ciao {quote.customerFirstName},{" "}
            {hasMultipleOptions ? contentSettings.multipleHeroIntro : contentSettings.singleHeroIntro}
          </p>
        </div>

        <div className="p-5 sm:p-7">
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
                      {child.age != null ? `${child.age} ${child.age === 1 ? "anno" : "anni"}` : "—"}
                    </li>
                  ))}
                </ul>
              </ContentBlock>
            </div>
          )}

          {quote.customerNotes && (
            <div className="mt-4">
              <section className="rounded-2xl bg-ischia-navy p-5 shadow-sm">
                <h3 className="text-xl font-black text-white">Note per te</h3>
                <div className="mt-3 whitespace-pre-line text-sm leading-6 text-white/90">{quote.customerNotes}</div>
              </section>
            </div>
          )}

          <div className="no-print mt-4 flex justify-end">
            <PrintButton quoteCode={quote.code} token={quote.token} />
          </div>
        </div>
      </section>

      <HesitantClientBanner
        show={showHesitantBanner && quote.status !== "confermato" && featureFlags.alternative_proposal === true}
        quoteCode={quote.code}
        token={quote.token}
      />

      <section className="no-print mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Strutture selezionate", "Hotel scelti e verificati dal nostro team"],
          ["Prezzi trasparenti", "Condizioni e servizi sempre visibili"],
          ["Assistenza dedicata", "Ti seguiamo prima e durante il soggiorno"]
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl bg-white px-4 py-4 text-center shadow-sm ring-1 ring-ischia-blue/10">
            <p className="text-sm font-black text-ischia-navy">{title}</p>
            <p className="mt-1 text-xs leading-5 text-ischia-ink/60">{text}</p>
          </div>
        ))}
      </section>

      <section className="mt-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-black tracking-[-0.02em] text-ischia-navy sm:text-4xl">{contentSettings.proposalsTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ischia-ink/65">
            {contentSettings.proposalsDescription}
          </p>
        </div>
        <QuoteProposalSection
          quote={quote}
          hotelPopularity={hotelPopularity}
          featureFlags={featureFlags}
          travelServices={travelServices}
          contentSettings={contentSettings}
        />
      </section>

      <MobileFloatingWhatsApp quote={quote} contentSettings={contentSettings} />
    </main>
    </QuotePageWrapper>
  );
}

function PublicQuoteStatusBadge({ quote }: { quote: PublicQuoteDTO }) {
  if (quote.confirmationAvailabilityStatus === "availability_confirmed") {
    return <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Confermato</span>;
  }
  if (quote.hasConfirmation) {
    return <span className="inline-flex rounded-full bg-ischia-sun/18 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">In attesa di conferma</span>;
  }
  return null;
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-h-[92px] flex-col justify-center gap-1 rounded-2xl bg-gradient-to-br from-white to-ischia-mist p-4 shadow-sm ring-1 ring-ischia-blue/10">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ischia-blue">{label}</p>
          <p className="text-[15px] font-black leading-5 text-ischia-navy">{value}</p>
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
