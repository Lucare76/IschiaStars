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

        <section className="print-card overflow-hidden rounded-[34px] bg-white shadow-[0_28px_80px_rgba(8,63,115,0.14)] ring-1 ring-ischia-blue/10">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="order-2 p-6 sm:p-8 lg:order-1 lg:p-10">
              <p className="inline-flex rounded-full bg-[#FFF3CF] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800">
                Preventivo {quote.code}
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.04em] text-ischia-navy sm:text-5xl lg:text-6xl">
                {hasMultipleOptions ? contentSettings.multipleHeroTitle : contentSettings.singleHeroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-ischia-ink/70">
                Ciao <strong className="text-ischia-navy">{quote.customerFirstName}</strong>,{" "}
                {hasMultipleOptions ? contentSettings.multipleHeroIntro : contentSettings.singleHeroIntro}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <MiniInfo label="Date" value={`${formatDate(quote.arrivalDate)} — ${formatDate(quote.departureDate)}`} />
                <MiniInfo label="Ospiti" value={guests} />
                <MiniInfo label="Camere" value={`${quote.rooms}`} />
                <MiniInfo label="Cliente" value={formatClientName(quote.customerFirstName, quote.customerLastName)} />
              </div>
            </div>

            <div className="relative order-1 min-h-[300px] overflow-hidden bg-ischia-navy lg:order-2 lg:min-h-[520px]">
              {quote.hotelOptions[0]?.hotelImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Ischia"
                    className="absolute inset-0 h-full w-full object-cover"
                    src={quote.hotelOptions[0].hotelImageUrl}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ischia-navy/85 via-ischia-navy/10 to-transparent" />
                </>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <IschiaStarsLogo light />
                <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-ischia-sand">IschiaStars</p>
                <p className="mt-2 max-w-md text-2xl font-black leading-tight">La tua vacanza a Ischia, costruita su misura.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-ischia-blue/10 bg-[#F7FBFE] p-5 sm:p-7">
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <CountdownBanner offerExpiresAt={quote.offerExpiresAt} isConfirmed={quote.status === "confermato"} />
              {quote.customerNotes ? (
                <section className="rounded-2xl bg-ischia-navy p-5 shadow-[0_14px_32px_rgba(8,63,115,0.18)]">
                  <h3 className="text-lg font-black text-white">Note per te</h3>
                  <div className="mt-3 whitespace-pre-line text-sm leading-6 text-white/90">{quote.customerNotes}</div>
                </section>
              ) : (
                <div className="rounded-2xl bg-white p-5 ring-1 ring-ischia-blue/10">
                  <p className="text-sm font-black text-ischia-navy">Tutto pronto per confrontare le proposte</p>
                  <p className="mt-1 text-sm leading-6 text-ischia-ink/60">Scorri le strutture e scegli quella che preferisci.</p>
                </div>
              )}
            </div>

            <section className="no-print mt-4 grid gap-3 sm:grid-cols-3">
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

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ischia-mist px-4 py-3 ring-1 ring-ischia-blue/10">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ischia-blue">{label}</p>
      <p className="mt-1 text-sm font-black leading-5 text-ischia-navy">{value}</p>
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
