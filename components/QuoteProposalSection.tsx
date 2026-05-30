"use client";

import { useRef, useState } from "react";
import { ConfirmQuoteForm } from "@/components/ConfirmQuoteForm";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Quote, QuoteHotelOption, TreatmentOption } from "@/lib/types";
import { formatCurrency, publicWhatsappLink } from "@/lib/utils";

type SelectedOption = {
  optionId: string;
  hotelName: string;
  treatmentKey: string;
  treatmentLabel: string;
  price: number;
};

export function QuoteProposalSection({ quote }: { quote: Quote }) {
  const [selected, setSelected] = useState<SelectedOption | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const options = getEffectiveHotelOptions(quote);
  const isConfirmed = quote.status === "confermato";

  function handleSelectTreatment(option: QuoteHotelOption, treatment: TreatmentOption) {
    setSelected({
      optionId: option.id,
      hotelName: option.hotelName,
      treatmentKey: treatment.key,
      treatmentLabel: treatment.label,
      price: treatment.price
    });
    trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "confirm_clicked", {
      optionId: option.id,
      treatmentKey: treatment.key
    });
    setTimeout(() => {
      confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <div className="space-y-5">
      {/* Hotel cards */}
      <div className="space-y-4">
        {options.map((option) => (
          option.treatments.length > 0 && (
            <HotelCard
              key={option.id}
              option={option}
              isConfirmed={isConfirmed}
              onSelectTreatment={(treatment) => handleSelectTreatment(option, treatment)}
              quote={quote}
            />
          )
        ))}
      </div>

      {/* WhatsApp link */}
      <div className="no-print rounded-2xl bg-white/90 p-5 shadow-soft">
        <a
          className="block w-full rounded-full bg-ischia-leaf px-5 py-3 text-center font-black text-white"
          href={publicWhatsappLink(`Ciao IschiaStars, vorrei informazioni sul preventivo ${quote.code}`)}
          onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "proposal_section" })}
        >
          Hai domande? Scrivici su WhatsApp
        </a>
      </div>

      {/* Conferma form */}
      <div ref={confirmRef} id="conferma" className="no-print">
        <ConfirmQuoteForm
          quote={quote}
          selectedOption={selected}
        />
      </div>
    </div>
  );
}

function HotelCard({
  option,
  isConfirmed,
  onSelectTreatment,
  quote
}: {
  option: QuoteHotelOption;
  isConfirmed: boolean;
  onSelectTreatment: (treatment: TreatmentOption) => void;
  quote: Quote;
}) {
  const services = option.includedServices ? option.includedServices.split("\n").filter(Boolean) : [];
  const stars = option.hotelStars ? "★".repeat(option.hotelStars) : null;

  return (
    <div className={`print-card overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ${option.isSelected ? "ring-emerald-400" : "ring-ischia-blue/10"}`}>
      {option.hotelImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={option.hotelName}
          className="h-44 w-full object-cover"
          src={option.hotelImageUrl}
        />
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">{option.hotelLocation}</p>
            <h3 className="mt-1 text-2xl font-black text-ischia-navy">{option.hotelName}</h3>
            {stars && <p className="mt-1 text-sm text-ischia-sun">{stars}</p>}
          </div>
          {option.isSelected && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Scelta dal cliente</span>
          )}
        </div>

        {services.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/70">Servizi inclusi</p>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s} className="text-sm text-ischia-ink/78">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Trattamenti con CTA */}
        <div className="mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/70">Trattamenti disponibili</p>
          {option.treatments.map((treatment) => (
            <div
              key={treatment.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ischia-mist p-4"
            >
              <div>
                <p className="font-black text-ischia-navy">{treatment.label}</p>
                <p className="text-2xl font-black tabular-nums text-ischia-navy">{formatCurrency(treatment.price)}</p>
              </div>
              {!isConfirmed && (
                <button
                  className="no-print rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy"
                  onClick={() => onSelectTreatment(treatment)}
                  type="button"
                >
                  Conferma questa opzione
                </button>
              )}
              {isConfirmed && option.isSelected && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Confermato</span>
              )}
            </div>
          ))}
        </div>

        {/* Condizioni */}
        {(option.paymentPolicy || option.cancellationPolicy) && (
          <div className="mt-4 border-t border-ischia-blue/10 pt-4 text-sm text-ischia-ink/70">
            {option.paymentPolicy && <p><strong>Pagamento:</strong> {option.paymentPolicy}</p>}
            {option.cancellationPolicy && <p className="mt-1"><strong>Cancellazione:</strong> {option.cancellationPolicy}</p>}
          </div>
        )}

        {option.notes && (
          <p className="mt-3 rounded-xl bg-ischia-sun/10 px-3 py-2 text-sm text-ischia-ink/80">{option.notes}</p>
        )}
      </div>
    </div>
  );
}
