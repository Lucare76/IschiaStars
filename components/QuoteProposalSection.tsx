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

function hasDisplayablePrice(treatment: TreatmentOption) {
  return Number.isFinite(treatment.price) && treatment.price > 0;
}

function visibleTreatments(option: QuoteHotelOption) {
  return option.treatments.filter(hasDisplayablePrice);
}

export function QuoteProposalSection({ quote }: { quote: Quote }) {
  const [selected, setSelected] = useState<SelectedOption | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const allOptions = getEffectiveHotelOptions(quote);

  // Raggruppa per hotelGroup: ogni gruppo è una struttura con potenziali multiple tipologie camera
  const groupedHotels = Array.from(
    allOptions.reduce((map, opt) => {
      const g = opt.hotelGroup ?? 1;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
      return map;
    }, new Map<number, QuoteHotelOption[]>())
  ).sort(([a], [b]) => a - b);

  const isConfirmed = quote.status === "confermato";

  function handleSelectTreatment(option: QuoteHotelOption, treatment: TreatmentOption) {
    setSelected({
      optionId: option.id,
      hotelName: option.hotelName + (option.roomTypeLabel ? ` — ${option.roomTypeLabel}` : ""),
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
      {/* Hotel cards raggruppate per struttura */}
      <div className="space-y-4">
        {groupedHotels.map(([groupId, groupOptions]) => {
          const optionsWithTreatments = groupOptions.filter((o) => visibleTreatments(o).length > 0);
          if (!optionsWithTreatments.length) return null;
          const firstOpt = optionsWithTreatments[0];
          return (
            <HotelCard
              key={groupId}
              mainOption={firstOpt}
              allGroupOptions={optionsWithTreatments}
              isConfirmed={isConfirmed}
              onSelectTreatment={handleSelectTreatment}
              quote={quote}
            />
          );
        })}
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
  mainOption,
  allGroupOptions,
  isConfirmed,
  onSelectTreatment,
  quote
}: {
  mainOption: QuoteHotelOption;
  allGroupOptions: QuoteHotelOption[];
  isConfirmed: boolean;
  onSelectTreatment: (option: QuoteHotelOption, treatment: TreatmentOption) => void;
  quote: Quote;
}) {
  const services = mainOption.includedServices ? mainOption.includedServices.split("\n").filter(Boolean) : [];
  const stars = mainOption.hotelStars ? "★".repeat(mainOption.hotelStars) : null;
  const isAnySelected = allGroupOptions.some((o) => o.isSelected);
  const hasMultipleRoomTypes = allGroupOptions.length > 1;

  return (
    <div className={`print-card overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ${isAnySelected ? "ring-emerald-400" : "ring-ischia-blue/10"}`}>
      {mainOption.hotelImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={mainOption.hotelName} className="h-44 w-full object-cover" src={mainOption.hotelImageUrl} />
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">{mainOption.hotelLocation}</p>
            <h3 className="mt-1 text-2xl font-black text-ischia-navy">{mainOption.hotelName}</h3>
            {stars && <p className="mt-1 text-sm text-ischia-sun">{stars}</p>}
          </div>
          {isAnySelected && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Scelta dal cliente</span>
          )}
        </div>

        {services.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/70">Servizi inclusi</p>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              {services.map((s) => <li key={s} className="text-sm text-ischia-ink/78">{s}</li>)}
            </ul>
          </div>
        )}

        {/* Per ogni tipologia camera, mostra i trattamenti */}
        <div className="mt-4 space-y-4">
          {allGroupOptions.map((opt) => (
            <div key={opt.id}>
              {hasMultipleRoomTypes && opt.roomTypeLabel && (
                <p className="mb-2 text-sm font-black text-ischia-navy">{opt.roomTypeLabel}</p>
              )}
              {opt.treatments.length > 0 && (
                <div className="space-y-2">
                  {visibleTreatments(opt).map((treatment) => (
                    <div key={`${opt.id}-${treatment.key}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ischia-mist p-4">
                      <div>
                        <p className="font-black text-ischia-navy">{treatment.label}</p>
                        <p className="text-2xl font-black tabular-nums text-ischia-navy">{formatCurrency(treatment.price)}</p>
                      </div>
                      {!isConfirmed && (
                        <button
                          className="no-print rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy"
                          onClick={() => onSelectTreatment(opt, treatment)}
                          type="button"
                        >
                          Conferma questa opzione
                        </button>
                      )}
                      {isConfirmed && opt.isSelected && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Confermato</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Condizioni dal primo option del gruppo */}
        {(mainOption.paymentPolicy || mainOption.cancellationPolicy) && (
          <div className="mt-4 border-t border-ischia-blue/10 pt-4 text-sm text-ischia-ink/70">
            {mainOption.paymentPolicy && <p><strong>Pagamento:</strong> {mainOption.paymentPolicy}</p>}
            {mainOption.cancellationPolicy && <p className="mt-1"><strong>Cancellazione:</strong> {mainOption.cancellationPolicy}</p>}
          </div>
        )}

        {mainOption.notes && (
          <p className="mt-3 rounded-xl bg-ischia-sun/10 px-3 py-2 text-sm text-ischia-ink/80">{mainOption.notes}</p>
        )}
      </div>
    </div>
  );
}
