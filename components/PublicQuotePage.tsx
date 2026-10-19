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
  const hasMultipleOptions = quote.hotelOptions.length > 1;
  const heroImage = quote.hotelOptions[0]?.hotelImageUrl;

  return (
    <QuotePageWrapper>
      <main className="print-page mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {trackOpening ? <PublicEventTracker quoteCode={quote.code} token={quote.token} source={openingSource} /> : null}

        <header className="no-print mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(8,63,115,0.08)] ring-1 ring-ischia-blue/10">
          <IschiaStarsLogo />
          <PublicQuoteHeaderActions quote={quote} contentSettings={contentSettings} />
        </header>

        <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_26px_80px_rgba(8,63,115,0.13)] ring-1 ring-ischia-blue/10">
          <div className="relative overflow-hidden">
            {heroImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/10" />
              </>
            ) : null}

            <div className="relative z-10 grid min-h-[420px] items-center lg:grid-cols-[1.05fr_0.95fr]">
              <div className="p-7 sm:p-10 lg:p-12">
                <p className="inline-flex rounded-full bg-[#FFF2CC] px-3 py-1 text-[11px] font-black uppercase tracking-[0.17em] text-amber-800">
                  Preventivo {quote.code}
                </p>
                <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.01] tracking-[-0.045em] text-ischia-navy sm:text-5xl lg:text-6xl">
                  {hasMultipleOptions ? contentSettings.multipleHeroTitle : contentSettings.singleHeroTitle}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-ischia-ink/72">
                  Ciao <strong className="text-ischia-navy">{quote.customerFirstName}</strong>,{" "}
                  {hasMultipleOptions ? contentSettings.multipleHeroIntro : contentSettings.singleHeroIntro}
                </p>
              </div>
              <div className="hidden min-h-[420px] lg:block" />
            </div>
          </div>

          <div className="relative z-20 -mt-7 px-5 sm:px-7">
            <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr_0.8fr_0.7fr_1.55fr]">
              <SummaryCard label="Cliente" value={formatClientName(quote.customerFirstName, quote.customerLastName)} />
              <SummaryCard label="Date" value={`${formatDate(quote.arrivalDate)} — ${formatDate(quote.departureDate)}`} />
              <SummaryCard label="Ospiti" value={guests} />
              <SummaryCard label="Camere" value={`${quote.rooms}`} />
              <div className="rounded-[22px] bg-ischia-navy p-4 text-white shadow-[0_14px_30px_rgba(8,63,115,0.24)]">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">Questa proposta è valida ancora</p>
                <div className="mt-2 [&>div]:!mt-0 [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>div]:!shadow-none [&>div]:!ring-0">
                  <CountdownBanner offerExpiresAt={quote.offerExpiresAt} isConfirmed={quote.status === "confermato"} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {quote.customerNotes ? (
              <section className="rounded-[22px] bg-ischia-navy px-5 py-4 text-white shadow-sm">
                <h3 className="text-lg font-black">Note per te</h3>
                <div className="mt-2 whitespace-pre-line text-sm leading-6 text-white/90">{quote.customerNotes}</div>
              </section>
            ) : null}

            {quote.isAlternative && quote.requestedHotel ? (
              <div className="mt-4 rounded-2xl bg-ischia-sun/15 p-4 text-sm font-semibold leading-6 text-ischia-navy ring-1 ring-ischia-sun/30">
                La struttura richiesta era {quote.requestedHotel}. Di seguito trovi la soluzione proposta disponibile per le date selezionate.
              </div>
            ) : null}

            {quote.children.length > 0 ? (
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
            ) : null}

            <section className="no-print mt-4 grid gap-3 sm:grid-cols-3">
              <TrustCard title="Strutture selezionate" text="Hotel scelti e verificati dal nostro team" symbol="◇" />
              <TrustCard title="Prezzi trasparenti" text="Condizioni e servizi sempre visibili" symbol="✓" />
              <TrustCard title="Assistenza dedicata" text="Ti seguiamo prima e durante il soggiorno" symbol="◉" />
            </section>

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

        <section className="mt-10">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ischia-blue">Le soluzioni che abbiamo scelto per te</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <h2 className="max-w-2xl text-3xl font-black tracking-[-0.03em] text-ischia-navy sm:text-4xl">
                {contentSettings.proposalsTitle}
              </h2>
              <p className="max-w-xl text-sm leading-6 text-ischia-ink/60">
                {contentSettings.proposalsDescription}
              </p>
            </div>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[96px] rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(8,63,115,0.08)] ring-1 ring-ischia-blue/10">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ischia-blue">{label}</p>
      <p className="mt-1 text-sm font-black leading-5 text-ischia-navy">{value}</p>
    </div>
  );
}

function TrustCard({ title, text, symbol }: { title: string; text: string; symbol: string }) {
  return (
    <div className="rounded-[20px] bg-[#F5FAFD] px-4 py-4 text-center ring-1 ring-ischia-blue/10">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-black text-ischia-blue ring-1 ring-ischia-blue/10">{symbol}</div>
      <p className="mt-2 text-sm font-black text-ischia-navy">{title}</p>
      <p className="mt-1 text-xs leading-5 text-ischia-ink/60">{text}</p>
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
