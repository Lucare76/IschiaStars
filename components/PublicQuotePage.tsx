import type { ReactNode } from "react";
import { ConfirmQuoteForm } from "@/components/ConfirmQuoteForm";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { PublicEventTracker } from "@/components/PublicEventTracker";
import { MobileFloatingWhatsApp, PublicQuoteHeaderActions, PublicQuoteMainActions } from "@/components/PublicQuoteActions";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { Quote } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function PublicQuotePage({ quote }: { quote: Quote }) {
  const guests = `${quote.adults} adulti${quote.children.length ? `, ${quote.children.length} bambini` : ""}`;

  return (
    <main className="print-page mx-auto max-w-5xl px-5 py-6">
      <PublicEventTracker quoteCode={quote.code} token={quote.token} />
      <header className="no-print mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/90 p-4 shadow-soft">
        <IschiaStarsLogo />
        <PublicQuoteHeaderActions quote={quote} />
      </header>

      <section className="print-card overflow-hidden rounded-[28px] bg-white shadow-soft">
        <div className="brand-shell p-6 text-white sm:p-9">
          <IschiaStarsLogo light />
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.16em] text-ischia-sand">Preventivo {quote.code}</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">La tua proposta di vacanza a Ischia</h1>
          <p className="mt-4 max-w-xl text-white/84">Ciao {quote.customerFirstName}, abbiamo preparato una proposta personalizzata per il tuo soggiorno.</p>
        </div>

        <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="rounded-2xl bg-ischia-mist p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">Hotel proposto</p>
                  <h2 className="mt-1 text-3xl font-black text-ischia-navy">{quote.proposedHotel.name}</h2>
                  <p className="mt-2 text-ischia-ink/70">{quote.proposedHotel.description}</p>
                </div>
                <QuoteStatusBadge status={quote.status} />
              </div>
              {quote.isAlternative ? (
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-ischia-sun/40">
                  <p className="font-black text-ischia-navy">Struttura alternativa proposta</p>
                  <p className="mt-2 font-semibold text-ischia-ink">La struttura richiesta non è disponibile per le date selezionate. Abbiamo selezionato per te una proposta alternativa con caratteristiche simili.</p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div><dt className="text-xs font-bold uppercase text-ischia-blue">Hotel richiesto</dt><dd className="font-bold">{quote.requestedHotel}</dd></div>
                    <div><dt className="text-xs font-bold uppercase text-ischia-blue">Alternativa</dt><dd className="font-bold">{quote.proposedHotel.name}</dd></div>
                  </dl>
                </div>
              ) : null}
            </div>

            <InfoGrid
              items={[
                ["Cliente", `${quote.customerFirstName} ${quote.customerLastName}`],
                ["Date", `${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`],
                ["Ospiti", guests],
                ["Camere", `${quote.rooms}`],
                ["Trattamento", quote.treatment],
                ["Validita offerta", formatDate(quote.offerExpiresAt)]
              ]}
            />

            <ContentBlock title="Servizi inclusi">
              <ul className="grid gap-2">
                {quote.servicesIncluded.map((service) => (
                  <li key={service} className="rounded-xl bg-white p-3 ring-1 ring-ischia-blue/10">{service}</li>
                ))}
              </ul>
            </ContentBlock>

            {quote.children.length ? (
              <ContentBlock title="Bambini">
                <ul className="grid gap-2">
                  {quote.children.map((child, index) => (
                    <li key={child.id} className="rounded-xl bg-white p-3 ring-1 ring-ischia-blue/10">
                      Bambino {index + 1}: nato il {formatDate(child.birthDate)}
                    </li>
                  ))}
                </ul>
              </ContentBlock>
            ) : null}

            <ContentBlock title="Condizioni">
              <p><strong>Pagamento:</strong> {quote.paymentPolicy}</p>
              <p className="mt-3"><strong>Cancellazione:</strong> {quote.cancellationPolicy}</p>
            </ContentBlock>
          </div>

          <aside className="space-y-5">
            <div className="print-card flex flex-col rounded-2xl bg-ischia-navy p-5 text-white shadow-soft">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-ischia-sand">Totale proposta</p>
              <p className="mt-3 text-4xl font-black tabular-nums">{formatCurrency(quote.totalPrice)}</p>
              <p className="mt-2 text-white/78">Acconto richiesto: <strong className="tabular-nums">{formatCurrency(quote.deposit)}</strong></p>
            </div>

            <ContentBlock title="Note per te">
              <p>{quote.customerNotes}</p>
            </ContentBlock>

            <PublicQuoteMainActions quote={quote} />
          </aside>
        </div>
      </section>

      <section id="conferma" className="no-print mt-6">
        <ConfirmQuoteForm quote={quote} />
      </section>
      <MobileFloatingWhatsApp quote={quote} />
    </main>
  );
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ischia-blue/10">
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
