import type { ReactNode } from "react";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { MobileFloatingWhatsApp, PublicQuoteHeaderActions } from "@/components/PublicQuoteActions";
import { PublicEventTracker } from "@/components/PublicEventTracker";
import { HesitantClientBanner } from "@/components/public/HesitantClientBanner";
import { CompactCountdownBanner } from "@/components/public/CompactCountdownBanner";
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
  const ischiaHeroImage =
    "https://images.musement.com/cover/0002/63/thumb_162850_cover_header.jpeg";
  const heroImage = hasMultipleOptions
    ? ischiaHeroImage
    : quote.hotelOptions[0]?.hotelImageUrl || ischiaHeroImage;

  return (
    <QuotePageWrapper>
      <main className="print-page mx-auto max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7">
        {trackOpening ? <PublicEventTracker quoteCode={quote.code} token={quote.token} source={openingSource} /> : null}

        <header className="no-print mb-4 flex items-center justify-between gap-4 rounded-[22px] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(8,63,115,0.08)] ring-1 ring-ischia-blue/10">
          <IschiaStarsLogo />
          <PublicQuoteHeaderActions quote={quote} contentSettings={contentSettings} />
        </header>

        <section className="overflow-hidden rounded-[30px] bg-white shadow-[0_22px_70px_rgba(8,63,115,0.12)] ring-1 ring-ischia-blue/10">
          <div className="relative min-h-[350px] overflow-hidden sm:min-h-[390px]">
            {heroImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="absolute inset-0 h-full w-full object-cover object-center" src={heroImage} />
                <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-white/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent" />
              </>
            ) : null}

            <div className="relative z-10 p-5 sm:p-8 lg:p-10">
              <div className="max-w-[650px] rounded-[26px] bg-white/96 p-6 shadow-[0_18px_45px_rgba(8,63,115,0.18)] ring-1 ring-white/90 backdrop-blur-[3px] sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#C89217] sm:text-sm">Preventivo {quote.code}</p>
                <h1 className="mt-3 max-w-[620px] text-[38px] font-black leading-[0.98] tracking-[-0.04em] text-ischia-navy sm:text-[52px] lg:text-[58px]">
                  {hasMultipleOptions ? contentSettings.multipleHeroTitle : contentSettings.singleHeroTitle}
                </h1>
                <p className="mt-5 max-w-[560px] text-[16px] font-semibold leading-7 text-ischia-navy sm:text-[17px]">
                  Ciao {quote.customerFirstName}, {hasMultipleOptions ? contentSettings.multipleHeroIntro : contentSettings.singleHeroIntro}
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-20 px-5 pt-5 sm:px-7">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.05fr_1.35fr_0.8fr_0.7fr_1.7fr] lg:items-stretch">
              <HeroStat icon="user" label="Cliente" value={formatClientName(quote.customerFirstName, quote.customerLastName)} />
              <HeroStat icon="calendar" label="Date" value={`${formatDate(quote.arrivalDate)} — ${formatDate(quote.departureDate)}`} />
              <HeroStat icon="guests" label="Ospiti" value={guests} />
              <HeroStat icon="bed" label="Camere" value={String(quote.rooms)} />
              <CompactCountdownBanner offerExpiresAt={quote.offerExpiresAt} isConfirmed={quote.status === "confermato"} />
            </div>
          </div>

          {quote.customerNotes ? (
            <div className="mx-5 mt-5 rounded-[20px] bg-ischia-navy px-5 py-4 text-white sm:mx-7">
              <p className="text-sm font-black">Note per te</p>
              <div className="mt-2 whitespace-pre-line text-sm leading-6 text-white/92">{quote.customerNotes}</div>
            </div>
          ) : null}

          <div className="p-5 sm:p-7">
            {quote.isAlternative && quote.requestedHotel ? (
              <div className="mb-4 rounded-2xl bg-ischia-sun/15 p-4 text-sm font-semibold leading-6 text-ischia-navy ring-1 ring-ischia-sun/30">
                La struttura richiesta era {quote.requestedHotel}. Di seguito trovi la soluzione proposta disponibile per le date selezionate.
              </div>
            ) : null}

            {quote.children.length > 0 ? (
              <div className="mb-4">
                <ContentBlock title="Bambini">
                  <ul className="grid gap-2">
                    {quote.children.map((child, index) => (
                      <li key={child.id} className="rounded-xl bg-white p-3 ring-1 ring-ischia-blue/10">
                        Bambino {index + 1}: {child.age != null ? `${child.age} ${child.age === 1 ? "anno" : "anni"}` : "—"}
                      </li>
                    ))}
                  </ul>
                </ContentBlock>
              </div>
            ) : null}

            <div className="no-print flex justify-end">
              <PrintButton quoteCode={quote.code} token={quote.token} />
            </div>
          </div>
        </section>

        <HesitantClientBanner
          show={showHesitantBanner && quote.status !== "confermato" && featureFlags.alternative_proposal === true}
          quoteCode={quote.code}
          token={quote.token}
        />

        <section className="mt-5">
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

function HeroStat({ icon, label, value }: { icon: "user" | "calendar" | "guests" | "bed"; label: string; value: string }) {
  const glyph = icon === "user" ? "◯" : icon === "calendar" ? "▣" : icon === "guests" ? "◎" : "▤";
  return (
    <div className="flex min-h-[116px] items-center gap-3 rounded-[20px] bg-white px-4 py-4 shadow-[0_8px_20px_rgba(8,63,115,0.08)] ring-1 ring-ischia-blue/10">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF5FC] text-lg font-black text-ischia-blue">{glyph}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ischia-blue">{label}</p>
        <p className="mt-1 text-sm font-black leading-5 text-ischia-navy">{value}</p>
      </div>
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
