import type { ReactNode } from "react";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { MobileFloatingWhatsApp, PublicQuoteHeaderActions } from "@/components/PublicQuoteActions";
import { PublicEventTracker } from "@/components/PublicEventTracker";
import { CommitmentBanner } from "@/components/public/CommitmentBanner";
import { HesitantClientBanner } from "@/components/public/HesitantClientBanner";
import { CountdownBanner } from "@/components/public/CountdownBanner";
import { QuotePageWrapper } from "@/components/public/QuotePageWrapper";
import { QuoteProposalSection } from "@/components/QuoteProposalSection";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { PrintButton } from "@/components/PrintButton";
import { Quote } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";

export function PublicQuotePage({ quote, hotelPopularity = {}, showHesitantBanner = false }: { quote: Quote; hotelPopularity?: Record<string, number>; showHesitantBanner?: boolean }) {
  const guests = `${quote.adults} adulti${quote.children.length ? `, ${quote.children.length} bambini` : ""}`;
  const options = getEffectiveHotelOptions(quote);
  const hasMultipleOptions = options.length > 1;

  return (
    <QuotePageWrapper customerFirstName={quote.customerFirstName} quoteCode={quote.code}>
    <main className="print-page mx-auto max-w-5xl px-5 py-6">
      <PublicEventTracker quoteCode={quote.code} token={quote.token} />

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
              <QuoteStatusBadge status={quote.status} />
            </div>
          </div>

          <InfoGrid
            items={[
              ["Cliente", `${quote.customerFirstName} ${quote.customerLastName}`],
              ["Date", `${formatDate(quote.arrivalDate)} — ${formatDate(quote.departureDate)}`],
              ["Ospiti", guests],
              ["Camere", `${quote.rooms}`],
              ...(quote.isAlternative && quote.requestedHotel ? [["Struttura richiesta", quote.requestedHotel] as [string, string]] : [])
            ]}
          />

          <CountdownBanner offerExpiresAt={quote.offerExpiresAt} isConfirmed={quote.status === "confermato"} />
          <CommitmentBanner show={quote.requiresCommitment === true} />

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
        show={showHesitantBanner && quote.status !== "confermato"}
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
        <QuoteProposalSection quote={quote} hotelPopularity={hotelPopularity} />
      </section>

      <MobileFloatingWhatsApp quote={quote} />
    </main>
    </QuotePageWrapper>
  );
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
