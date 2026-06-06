"use client";

import { useRef, useState } from "react";
import { ConfirmQuoteForm } from "@/components/ConfirmQuoteForm";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { BALANCE_METHOD_IN_STRUCTURE, calculatePaymentBreakdown } from "@/lib/hotel-policies";
import { publicQuoteInfoWhatsappMessage } from "@/lib/message-templates";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Quote, QuoteHotelOption, TreatmentOption } from "@/lib/types";
import { extractHighlightedFeatures } from "@/lib/highlight-features";
import { formatCurrency, publicWhatsappLink } from "@/lib/utils";

type SelectedOption = {
  optionId: string;
  hotelName: string;
  treatmentKey: string;
  treatmentLabel: string;
  price: number;
  depositPercent?: number;
  depositAmount?: number;
  balanceAmount?: number;
  balanceMethod?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
};

function hasDisplayablePrice(treatment: TreatmentOption) {
  return Number.isFinite(treatment.price) && treatment.price > 0;
}

function visibleTreatments(option: QuoteHotelOption) {
  return option.treatments.filter(hasDisplayablePrice);
}

function treatmentDetails(option: QuoteHotelOption, treatment: TreatmentOption) {
  if (treatment.key === "breakfast") return option.breakfastDetails?.trim();
  if (treatment.key === "half_board") return option.halfBoardDetails?.trim();
  return option.fullBoardDetails?.trim();
}

function treatmentPriceDeltas(option: QuoteHotelOption) {
  const activeTreatments = visibleTreatments(option);
  if (activeTreatments.length <= 1) return new Map<string, number>();

  return activeTreatments.slice(1).reduce((deltas, treatment, index) => {
    const previous = activeTreatments[index];
    const delta = treatment.price - previous.price;
    if (Number.isFinite(delta) && delta > 0) deltas.set(treatment.key, delta);
    return deltas;
  }, new Map<string, number>());
}

function treatmentBenefit(treatment: TreatmentOption) {
  if (treatment.key === "half_board") return "Cena inclusa ogni sera — nessun pensiero al ristorante";
  if (treatment.key === "full_board") return "Pranzo e cena inclusi — tutto compreso";
  return undefined;
}

function treatmentDescription(treatment: TreatmentOption) {
  if (treatment.key === "breakfast") return "Include pernottamento e prima colazione.";
  if (treatment.key === "half_board") return "Include pernottamento, prima colazione e un pasto secondo le condizioni della struttura.";
  return "Include pernottamento, prima colazione, pranzo e cena secondo le condizioni della struttura.";
}

function splitLines(value?: string) {
  return value?.split("\n").map((item) => item.trim()).filter(Boolean) ?? [];
}

function sharperWordPressImageUrl(url?: string) {
  if (!url) return undefined;
  return url.replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp|avif)(?:\?|$))/i, "");
}

function badgeColorClass(badge: string) {
  if (badge === "Consigliato") return "bg-[#C9A84C]";
  if (badge === "Miglior prezzo") return "bg-[#16A34A]";
  if (badge === "Più richiesto") return "bg-[#2563EB]";
  if (badge === "Soluzione premium") return "bg-[#1B3A5C]";
  if (badge === "Ideale per famiglie") return "bg-[#7C3AED]";
  if (badge === "Vicino al mare") return "bg-[#0891B2]";
  return "";
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
    const breakdown = calculatePaymentBreakdown(treatment.price, option.depositPercent, option.balanceMethod || BALANCE_METHOD_IN_STRUCTURE);
    setSelected({
      optionId: option.id,
      hotelName: option.hotelName + (option.roomTypeLabel ? ` — ${option.roomTypeLabel}` : ""),
      treatmentKey: treatment.key,
      treatmentLabel: treatment.label,
      price: treatment.price,
      depositPercent: breakdown.depositPercent,
      depositAmount: breakdown.depositAmount,
      balanceAmount: breakdown.balanceAmount,
      balanceMethod: breakdown.balanceMethod,
      paymentPolicy: option.paymentPolicy,
      cancellationPolicy: option.cancellationPolicy
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
              quoteCode={quote.code}
              token={quote.token}
              onSelectTreatment={handleSelectTreatment}
            />
          );
        })}
      </div>

      {/* WhatsApp link */}
      <div className="no-print rounded-2xl bg-white/90 p-5 shadow-soft">
        <a
          className="block w-full rounded-full bg-ischia-leaf px-5 py-3 text-center font-black text-white"
          href={publicWhatsappLink(publicQuoteInfoWhatsappMessage(quote))}
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
  quoteCode,
  token,
  onSelectTreatment
}: {
  mainOption: QuoteHotelOption;
  allGroupOptions: QuoteHotelOption[];
  isConfirmed: boolean;
  quoteCode: string;
  token: string;
  onSelectTreatment: (option: QuoteHotelOption, treatment: TreatmentOption) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedTreatmentDetails, setExpandedTreatmentDetails] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ option: QuoteHotelOption; treatment: TreatmentOption } | null>(null);
  const services = splitLines(mainOption.includedServices);
  const stars = mainOption.hotelStars ? "★".repeat(mainOption.hotelStars) : null;
  const isAnySelected = allGroupOptions.some((o) => o.isSelected);
  const hasMultipleRoomTypes = allGroupOptions.length > 1;
  const imageUrl = sharperWordPressImageUrl(mainOption.hotelImageUrl);
  const badge = mainOption.badge?.trim();
  const hotelReason = mainOption.hotelReason?.trim();
  const features = extractHighlightedFeatures({
    hotelName: mainOption.hotelName,
    includedServices: mainOption.includedServices,
    notes: mainOption.notes,
  });

  return (
    <div className={`print-card relative overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ${isAnySelected ? "ring-emerald-400" : "ring-ischia-blue/10"} ${badge === "Consigliato" ? "ring-2 ring-[#C9A84C]" : ""}`}>
      {badge ? (
        <span className={`absolute left-0 top-0 z-10 rounded-br-lg px-3 py-1 text-xs font-bold uppercase text-white ${badgeColorClass(badge)}`}>
          {badge}
        </span>
      ) : null}
      <div className={imageUrl ? "grid lg:grid-cols-[minmax(18rem,0.42fr)_1fr]" : ""}>
        {imageUrl && (
          <div className="bg-ischia-mist lg:min-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={mainOption.hotelName} className="h-56 w-full object-cover sm:h-64 lg:h-full" decoding="async" src={imageUrl} />
          </div>
        )}
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">{mainOption.hotelLocation}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-black text-ischia-navy">{mainOption.hotelName}</h3>
              {mainOption.sourceUrl ? (
                <a
                  className="no-print rounded-full bg-white px-3 py-1 text-xs font-black text-ischia-blue ring-1 ring-ischia-blue/20"
                  href={mainOption.sourceUrl}
                  onClick={() => trackQuoteEvent({ quoteCode, token }, "hotel_link_clicked", {
                    hotelOptionId: mainOption.id,
                    hotelName: mainOption.hotelName,
                    sourceUrl: mainOption.sourceUrl
                  })}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Vedi l&apos;hotel
                </a>
              ) : null}
            </div>
            {stars && <p className="mt-1 text-sm text-ischia-sun">{stars}</p>}
          </div>
          {isAnySelected && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Scelta dal cliente</span>
          )}
        </div>

        {hotelReason ? (
          <div className="mt-3 rounded-r-lg border-l-[3px] border-[#C9A84C] bg-[#FBF5E6] px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#C9A84C]">Perché te lo proponiamo</p>
            <p className="mt-1 text-sm text-gray-700">{hotelReason}</p>
          </div>
        ) : null}

        {features.length > 0 && (
          <div className="mt-3">
            <div className="no-print">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Plus inclusi</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {features.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/60">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>
            <p className="hidden print:block text-sm text-ischia-ink/80">
              <strong>Plus inclusi:</strong> {features.join(", ")}
            </p>
          </div>
        )}

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
                  {visibleTreatments(opt).map((treatment) => {
                    const detailKey = `${opt.id}-${treatment.key}`;
                    const isExpanded = expanded === detailKey;
                    const details = treatmentDetails(opt, treatment);
                    const priceDelta = treatmentPriceDeltas(opt).get(treatment.key);
                    const benefit = details ? undefined : treatmentBenefit(treatment);
                    const areTreatmentDetailsExpanded = expandedTreatmentDetails === detailKey;
                    return (
                    <div key={detailKey} className="rounded-2xl bg-ischia-mist p-4">
                      {(() => {
                        const breakdown = calculatePaymentBreakdown(treatment.price, opt.depositPercent, opt.balanceMethod || BALANCE_METHOD_IN_STRUCTURE);
                        return (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-ischia-navy">{treatment.label}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-2xl font-black tabular-nums text-ischia-navy">{formatCurrency(treatment.price)}</p>
                            {priceDelta != null ? (
                              <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-xs font-medium text-[#16A34A]">
                                +{formatCurrency(priceDelta)}
                              </span>
                            ) : null}
                          </div>
                          {priceDelta != null && benefit ? (
                            <p className="mt-0.5 text-xs italic text-gray-500">{benefit}</p>
                          ) : null}
                          {details ? (
                            <div className="mt-1">
                              <button
                                aria-expanded={areTreatmentDetailsExpanded}
                                className="no-print text-xs font-bold text-[#C9A84C]"
                                onClick={() => setExpandedTreatmentDetails(areTreatmentDetailsExpanded ? null : detailKey)}
                                type="button"
                              >
                                Cosa include ›
                              </button>
                              {areTreatmentDetailsExpanded ? (
                                <p className="mt-1 whitespace-pre-line rounded-r-md border-l-2 border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs text-gray-600">
                                  {details}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {breakdown.depositPercent > 0 ? (
                            <p className="mt-1 text-sm font-semibold text-ischia-ink/72">
                              Acconto {breakdown.depositPercent}%: {formatCurrency(breakdown.depositAmount)} · Saldo {formatCurrency(breakdown.balanceAmount)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            aria-expanded={isExpanded}
                            className="no-print rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/15"
                            onClick={() => {
                              const nextExpanded = isExpanded ? null : detailKey;
                              setExpanded(nextExpanded);
                              if (nextExpanded) {
                                trackQuoteEvent({ quoteCode, token }, "details_opened", {
                                  hotelOptionId: opt.id,
                                  hotelName: opt.hotelName,
                                  treatmentKey: treatment.key,
                                  treatmentLabel: treatment.label
                                });
                              }
                            }}
                            type="button"
                          >
                            Cosa include
                          </button>
                          {!isConfirmed && (
                            <div className="no-print text-center">
                              <button
                                className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy"
                                onClick={() => setPendingSelection({ option: opt, treatment })}
                                type="button"
                              >
                                Conferma questa opzione
                              </button>
                              <p className="mt-1 text-center text-xs text-gray-400">Nessun pagamento online — ti ricontattiamo per finalizzare</p>
                            </div>
                          )}
                          {isConfirmed && opt.isSelected && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Confermato</span>
                          )}
                        </div>
                      </div>
                        );
                      })()}
                      <TreatmentDetails className={`${isExpanded ? "block" : "hidden"} print:block`} option={opt} treatment={treatment} />
                    </div>
                  );})}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Condizioni dal primo option del gruppo */}
        {(mainOption.depositPercent != null || mainOption.balanceMethod || mainOption.paymentPolicy || mainOption.cancellationPolicy) && (
          <div className="mt-4 border-t border-ischia-blue/10 pt-4 text-sm text-ischia-ink/70">
            {mainOption.depositPercent != null ? <p><strong>Acconto:</strong> {mainOption.depositPercent}%</p> : null}
            {mainOption.balanceMethod ? <p className="mt-1"><strong>Saldo:</strong> {mainOption.balanceMethod}</p> : null}
            {mainOption.paymentPolicy && <p><strong>Pagamento:</strong> {mainOption.paymentPolicy}</p>}
            {mainOption.cancellationPolicy && <p className="mt-1"><strong>Cancellazione:</strong> {mainOption.cancellationPolicy}</p>}
          </div>
        )}

        {mainOption.notes && (
          <p className="mt-3 rounded-xl bg-ischia-sun/10 px-3 py-2 text-sm text-ischia-ink/80">{mainOption.notes}</p>
        )}
      </div>
      </div>
      {pendingSelection ? (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" role="dialog" aria-modal="true" aria-labelledby={`confirm-selection-${pendingSelection.option.id}`}>
          <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black text-ischia-navy" id={`confirm-selection-${pendingSelection.option.id}`}>Stai confermando la tua preferenza</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Il nostro staff verificherà la disponibilità definitiva della struttura scelta e ti ricontatterà per completare la prenotazione.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20"
                onClick={() => setPendingSelection(null)}
                type="button"
              >
                Annulla
              </button>
              <button
                className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy"
                onClick={() => {
                  onSelectTreatment(pendingSelection.option, pendingSelection.treatment);
                  setPendingSelection(null);
                }}
                type="button"
              >
                Sì, confermo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TreatmentDetails({ option, treatment, className }: { option: QuoteHotelOption; treatment: TreatmentOption; className?: string }) {
  const services = splitLines(option.includedServices);
  const breakdown = calculatePaymentBreakdown(treatment.price, option.depositPercent, option.balanceMethod || BALANCE_METHOD_IN_STRUCTURE);
  const hasDetails = services.length > 0 || option.paymentPolicy || option.cancellationPolicy || option.paymentNotes || option.notes || breakdown.depositPercent > 0;

  return (
    <div className={`mt-3 rounded-xl bg-white/85 p-4 text-sm leading-6 text-ischia-ink/78 ring-1 ring-ischia-blue/10 ${className ?? ""}`}>
      <p className="font-black text-ischia-navy">Cosa include questa opzione</p>
      <div className="mt-2 grid gap-1">
        <p><strong>Hotel:</strong> {option.hotelName}</p>
        <p><strong>Trattamento:</strong> {treatment.label}</p>
        <p><strong>Prezzo:</strong> {formatCurrency(treatment.price)}</p>
        {breakdown.depositPercent > 0 ? (
          <>
            <p><strong>Acconto richiesto:</strong> {breakdown.depositPercent}% pari a {formatCurrency(breakdown.depositAmount)}</p>
            <p><strong>Saldo restante:</strong> {formatCurrency(breakdown.balanceAmount)} {breakdown.balanceMethod.replace(/^Saldo restante\s*/i, "").replace(/\.$/, "")}.</p>
          </>
        ) : null}
        <p>{treatmentDescription(treatment)}</p>
      </div>

      {services.length > 0 ? (
        <div className="mt-3">
          <p className="font-bold text-ischia-navy">Servizi inclusi</p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {services.map((service) => <li key={service}>{service}</li>)}
          </ul>
        </div>
      ) : null}
      {option.paymentPolicy ? <p className="mt-3"><strong>Condizioni di pagamento:</strong> {option.paymentPolicy}</p> : null}
      {option.paymentNotes ? <p className="mt-2"><strong>Note pagamento:</strong> {option.paymentNotes}</p> : null}
      {option.cancellationPolicy ? <p className="mt-2"><strong>Politiche di cancellazione:</strong> {option.cancellationPolicy}</p> : null}
      {option.notes ? <p className="mt-2"><strong>Note:</strong> {option.notes}</p> : null}
      {!hasDetails ? (
        <p className="mt-3">I dettagli completi verranno confermati dal nostro staff in fase di prenotazione.</p>
      ) : null}
      <p className="mt-3 text-xs font-semibold text-ischia-ink/65">
        La proposta e soggetta a disponibilita al momento della conferma definitiva.
      </p>
    </div>
  );
}
