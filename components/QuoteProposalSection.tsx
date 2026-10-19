"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmQuoteForm } from "@/components/ConfirmQuoteForm";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { emptyFeatureFlags, FeatureFlags } from "@/lib/feature-flags";
import type { ExtraServiceEmailItem } from "@/lib/extra-service-email-items";
import { BALANCE_METHOD_IN_STRUCTURE, calculatePaymentBreakdown, getMandatoryHotelFeeNote } from "@/lib/hotel-policies";
import { publicQuoteInfoWhatsappMessage } from "@/lib/message-templates";
import type { PublicQuoteDTO, PublicQuoteHotelOptionDTO } from "@/lib/public-quote-dto";
import { defaultQuoteContentSettings, type QuoteContentSettings } from "@/lib/quote-content-settings";
import type { QuoteRoomSelection, TreatmentOption } from "@/lib/types";
import { extractHighlightedFeatures } from "@/lib/highlight-features";
import { buildHotelNotes } from "@/lib/hotel-notes";
import { safeSessionStorageGet, safeSessionStorageSet } from "@/lib/safe-storage";
import { formatCurrency, publicWhatsappLink } from "@/lib/utils";

function hasDisplayablePrice(treatment: TreatmentOption) {
  return Number.isFinite(treatment.price) && treatment.price > 0;
}

function visibleTreatments(option: PublicQuoteHotelOptionDTO) {
  return option.treatments.filter(hasDisplayablePrice);
}

function treatmentDetails(option: PublicQuoteHotelOptionDTO, treatment: TreatmentOption) {
  if (treatment.key === "breakfast") return option.breakfastDetails?.trim();
  if (treatment.key === "half_board") return option.halfBoardDetails?.trim();
  return option.fullBoardDetails?.trim();
}

function treatmentPriceDeltas(option: PublicQuoteHotelOptionDTO) {
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

function UsersIcon() {
  return (
    <svg fill="none" height={13} stroke="#16A34A" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={13}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PopularityBadge({ count }: { count: number }) {
  if (count < 3) return null;
  const text = count >= 10
    ? `Uno dei più richiesti — scelto da ${count} clienti quest'estate`
    : `Scelto da ${count} clienti IschiaStars quest'estate`;
  return (
    <span
      className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-[#16A34A]"
      style={{ background: "#DCFCE7" }}
    >
      <UsersIcon />
      {text}
    </span>
  );
}

function ChevronIcon({ rotated }: { rotated: boolean }) {
  return (
    <svg
      className={`flex-shrink-0 transition-transform duration-300 ${rotated ? "rotate-180" : ""}`}
      fill="none"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={16}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg fill="none" height={16} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={16}>
      <rect height={18} rx={1} width={9} x={2} y={3} />
      <rect height={18} rx={1} width={9} x={13} y={3} />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg fill="none" height={36} stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 24 24" width={36}>
      <path d="M3 21h18" />
      <path d="M9 8h1" />
      <path d="M9 12h1" />
      <path d="M9 16h1" />
      <path d="M14 8h1" />
      <path d="M14 12h1" />
      <path d="M14 16h1" />
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    </svg>
  );
}
function ServiceIcon({ service }: { service: string }) {
  const s = service.toLowerCase();
  const common = {
    fill: "none",
    height: 18,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 18
  };

  if (s.includes("wi-fi") || s.includes("wifi")) {
    return <svg {...common}><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" /></svg>;
  }
  if (s.includes("piscina")) {
    return <svg {...common}><path d="M3 8h5v5" /><path d="M8 10h5v5" /><path d="M3 17c1 .8 2 1.2 3 1.2S8 17.8 9 17s2-1.2 3-1.2 2 .4 3 1.2 2 1.2 3 1.2 2-.4 3-1.2" /></svg>;
  }
  if (s.includes("spa") || s.includes("terme")) {
    return <svg {...common}><path d="M12 21s-6-3.5-6-9a6 6 0 0 1 12 0c0 5.5-6 9-6 9Z" /><path d="M12 21V8" /><path d="M8.5 11.5 12 15l3.5-3.5" /></svg>;
  }
  if (s.includes("aria") || s.includes("climat")) {
    return <svg {...common}><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M2 12h20" /></svg>;
  }
  if (s.includes("parcheggio")) {
    return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 16V8h4a3 3 0 1 1 0 6H9" /></svg>;
  }
  if (s.includes("ristorante")) {
    return <svg {...common}><path d="M6 3v8M3 3v5a3 3 0 0 0 6 0V3M6 11v10M16 3v18M16 3c3 2 3 7 0 9" /></svg>;
  }
  if (s.includes("palestra")) {
    return <svg {...common}><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12" /></svg>;
  }
  if (s.includes("colazione")) {
    return <svg {...common}><path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-4Z" /><path d="M16 11h2a2 2 0 0 1 0 4h-2" /><path d="M7 3v3M11 3v3" /></svg>;
  }
  if (s.includes("animali")) {
    return <svg {...common}><circle cx="8" cy="8" r="1.5" /><circle cx="16" cy="8" r="1.5" /><circle cx="6" cy="13" r="1.5" /><circle cx="18" cy="13" r="1.5" /><path d="M9 18c1.2-2.3 4.8-2.3 6 0" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="7" /><path d="m9 12 2 2 4-4" /></svg>;
}


function CommitmentNoteBadge({ note }: { note: string }) {
  return (
    <div className="mt-2 rounded-xl border-2 border-ischia-sun bg-[#FFF8E6] p-2.5 text-ischia-navy shadow-[0_8px_18px_rgba(8,63,115,0.12)]">
      <div className="rounded-lg border border-ischia-sun bg-white px-3 py-2 text-sm font-black text-ischia-navy shadow-sm">
        + {note}
      </div>
    </div>
  );
}

export function QuoteProposalSection({
  quote,
  hotelPopularity = {},
  featureFlags = emptyFeatureFlags,
  travelServices = [],
  contentSettings = defaultQuoteContentSettings
}: {
  quote: PublicQuoteDTO;
  hotelPopularity?: Record<string, number>;
  featureFlags?: FeatureFlags;
  travelServices?: ExtraServiceEmailItem[];
  contentSettings?: QuoteContentSettings;
}) {
  const [selectedRooms, setSelectedRooms] = useState<QuoteRoomSelection[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const allOptions = quote.hotelOptions;

  // Raggruppa per hotelGroup: ogni gruppo è una struttura con potenziali multiple tipologie camera
  const groupedHotels = Array.from(
    allOptions.reduce((map, opt) => {
      const g = opt.hotelGroup ?? 1;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
      return map;
    }, new Map<number, PublicQuoteHotelOptionDTO[]>())
  ).sort(([a], [b]) => a - b);

  // Sort stabile: badge prioritario ("Consigliato", "Più richiesto") sempre in cima.
  const PRIORITY_BADGES = ["Consigliato", "Più richiesto"];
  const sortedGroups = [...groupedHotels].sort(([, aOpts], [, bOpts]) => {
    const aBadge = aOpts.find((o) => visibleTreatments(o).length > 0)?.badge?.trim() ?? "";
    const bBadge = bOpts.find((o) => visibleTreatments(o).length > 0)?.badge?.trim() ?? "";
    return (PRIORITY_BADGES.includes(aBadge) ? 0 : 1) - (PRIORITY_BADGES.includes(bBadge) ? 0 : 1);
  });

  // Pre-filtra gruppi che hanno almeno un trattamento visibile.
  const renderableGroups = sortedGroups.filter(([, opts]) =>
    opts.some((o) => visibleTreatments(o).length > 0)
  );

  const isConfirmed = quote.status === "confermato";
  function handleSelectTreatment(option: PublicQuoteHotelOptionDTO, treatment: TreatmentOption) {
    const breakdown = calculatePaymentBreakdown(treatment.price, option.depositPercent, option.balanceMethod || BALANCE_METHOD_IN_STRUCTURE);
    const roomSelection: QuoteRoomSelection = {
      optionId: option.id,
      hotelGroup: option.hotelGroup ?? 1,
      hotelName: option.hotelName,
      treatmentKey: treatment.key,
      treatmentLabel: treatment.label,
      price: treatment.price,
      depositPercent: breakdown.depositPercent,
      depositAmount: breakdown.depositAmount,
      balanceAmount: breakdown.balanceAmount,
      balanceMethod: breakdown.balanceMethod,
      paymentPolicy: option.paymentPolicy,
      cancellationPolicy: option.cancellationPolicy,
      roomTypeLabel: option.roomTypeLabel
    };
    setSelectedRooms((current) => {
      const sameHotel = current.length === 0 || current[0].hotelGroup === roomSelection.hotelGroup;
      const base = sameHotel && current.length < quote.rooms ? current : [];
      return [...base, roomSelection].slice(0, quote.rooms);
    });
    trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "confirm_clicked", {
      optionId: option.id,
      treatmentKey: treatment.key
    });
    if (selectedRooms.length + 1 >= quote.rooms) {
      setTimeout(() => confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }

  return (
    <div className="space-y-6">
      {/* Bottone toggle confronto — visibile solo con 2+ gruppi hotel */}
      {groupedHotels.length >= 2 && (
        <div className="no-print">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[#C9A84C] bg-transparent px-5 py-2 text-sm font-medium text-[#C9A84C] transition-colors hover:bg-[#FBF5E6]"
            onClick={() => {
              if (!compareMode) {
                trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "compare_opened");
              }
              setCompareMode((prev) => !prev);
            }}
            type="button"
          >
            <ColumnsIcon />
            {compareMode ? "Torna alle proposte" : "Confronta le opzioni"}
          </button>
        </div>
      )}

      {compareMode ? (
        <CompareView
          groupedHotels={groupedHotels}
          hotelPopularity={hotelPopularity}
          isConfirmed={isConfirmed}
          onSelectTreatment={handleSelectTreatment}
        />
      ) : (
        /* Hotel cards raggruppate per struttura */
        <div className="space-y-6">
          {renderableGroups.map(([groupId, groupOptions]) => {
            const optionsWithTreatments = groupOptions.filter((o) => visibleTreatments(o).length > 0);
            const firstOpt = optionsWithTreatments[0];
            return (
              <div key={groupId}>
                <HotelCard
                  mainOption={firstOpt}
                  allGroupOptions={optionsWithTreatments}
                  isConfirmed={isConfirmed}
                  popularity={hotelPopularity[firstOpt.hotelName] ?? 0}
                  quoteCode={quote.code}
                  token={quote.token}
                  featureFlags={featureFlags}
                  quote={quote}
                  onSelectTreatment={handleSelectTreatment}
                />
              </div>
            );
          })}
        </div>
      )}

      {quote.rooms > 1 && selectedRooms.length > 0 ? (
        <div className="no-print rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ischia-blue/10">
          <p className="text-sm font-black text-ischia-navy">Composizione camere: {selectedRooms.length} di {quote.rooms}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {selectedRooms.map((room, index) => (
              <div key={`${room.optionId}-${room.treatmentKey}-${index}`} className="rounded-xl bg-ischia-mist p-3 text-sm">
                <p className="text-lg font-black text-ischia-navy">Camera {index + 1}</p>
                <p>{room.roomTypeLabel || "Camera standard"}</p>
                <p>{room.treatmentLabel} - {formatCurrency(room.price)}</p>
                <button className="mt-2 text-xs font-bold text-rose-700" type="button" onClick={() => setSelectedRooms((rooms) => rooms.filter((_, roomIndex) => roomIndex !== index))}>
                  Cambia questa camera
                </button>
              </div>
            ))}
          </div>
          {selectedRooms.length < quote.rooms ? <p className="mt-3 text-sm font-semibold text-amber-800">Ora scegli tipologia e trattamento per la camera {selectedRooms.length + 1} nello stesso hotel.</p> : null}
        </div>
      ) : null}

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

      {travelServices.length > 0 ? (
        <div className="no-print rounded-2xl bg-ischia-mist p-6 ring-1 ring-ischia-blue/15">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">{contentSettings.travelEyebrow}</p>
          <h2 className="mt-1 text-2xl font-black text-ischia-navy">{contentSettings.travelTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ischia-ink/70">
            {contentSettings.travelDescription}
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
          <p className="mt-4 text-xs text-ischia-ink/55">{contentSettings.travelDisclaimer}</p>
          <p className="mt-2 text-sm font-semibold text-ischia-navy">{contentSettings.travelCta}</p>
        </div>
      ) : null}

      {/* Conferma form */}
      <div ref={confirmRef} id="conferma" className="no-print">
        <ConfirmQuoteForm
          quote={quote}
          selectedRooms={selectedRooms}
        />
      </div>
    </div>
  );
}

function CompareView({
  groupedHotels,
  hotelPopularity,
  isConfirmed,
  onSelectTreatment,
}: {
  groupedHotels: [number, PublicQuoteHotelOptionDTO[]][];
  hotelPopularity: Record<string, number>;
  isConfirmed: boolean;
  onSelectTreatment: (option: PublicQuoteHotelOptionDTO, treatment: TreatmentOption) => void;
}) {
  const [pendingSelection, setPendingSelection] = useState<{
    option: PublicQuoteHotelOptionDTO;
    treatment: TreatmentOption;
  } | null>(null);

  const groups = groupedHotels
    .map(([groupId, options]) => {
      const withTreatments = options.filter((o) => visibleTreatments(o).length > 0);
      if (!withTreatments.length) return null;
      return { groupId, mainOption: withTreatments[0] };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  if (!groups.length) return null;

  const is3 = groups.length >= 3;
  // 3 hotel: ogni colonna ha minWidth 260px → forza scroll orizzontale su mobile
  const colTemplate = is3 ? "repeat(3, minmax(260px, 1fr))" : "repeat(2, 1fr)";

  return (
    <>
      <div className={is3 ? "overflow-x-auto" : ""}>
        {/*
          Layout CSS subgrid: il grid padre definisce 8 righe (una per sezione).
          Ogni colonna-hotel usa grid-template-rows: subgrid per partecipare
          alle stesse righe del padre → tutte le colonne hanno righe allineate.
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            gridTemplateRows: "repeat(8, auto)",
            columnGap: 16,
            rowGap: 0,
          }}
        >
          {groups.map(({ groupId, mainOption }, colIndex) => {
            const rawBadge = mainOption.badge?.trim();
            const isRecommended = rawBadge === "Consigliato";
            const imageUrl = sharperWordPressImageUrl(mainOption.hotelImageUrl);
            const badge = rawBadge && !["Più economica", "Più completa"].includes(rawBadge) ? rawBadge : undefined;
            const hotelReason = mainOption.hotelReason?.trim();
            const commitmentNote = mainOption.commitmentNote?.trim();
            const services = splitLines(mainOption.includedServices);
            const mandatoryFeeNote = getMandatoryHotelFeeNote(mainOption.hotelName);
            const treatments = visibleTreatments(mainOption);
            const minPrice = treatments.length > 0 ? Math.min(...treatments.map((t) => t.price)) : null;
            const firstTreatment = treatments[0] ?? null;
            const headerBg = isRecommended ? "#FBF5E6" : "#ffffff";
            const sep: React.CSSProperties = { borderTop: "1px solid #F3F4F6", padding: "12px 16px" };

            return (
              <div
                key={groupId}
                style={{
                  display: "grid",
                  gridColumn: colIndex + 1,
                  gridRow: "1 / 9",
                  gridTemplateRows: "subgrid",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: isRecommended ? "2px solid #C9A84C" : "1px solid #E5E7EB",
                }}
              >
                {/* Riga 1: FOTO */}
                <div style={{ background: headerBg }}>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={mainOption.hotelName}
                      className="w-full object-cover object-center"
                      decoding="async"
                      src={imageUrl}
                      style={{ aspectRatio: "4/3" }}
                    />
                  ) : (
                    <div
                      className="flex w-full items-center justify-center"
                      style={{ aspectRatio: "4/3", background: "#F3F4F6" }}
                    >
                      <BuildingIcon />
                    </div>
                  )}
                </div>

                {/* Riga 2: NOME + STELLE + POPOLARITÀ */}
                <div style={{ ...sep, background: headerBg }}>
                  <p className="font-bold leading-tight text-[#1B3A5C]" style={{ fontSize: 15 }}>
                    {mainOption.hotelName}
                  </p>
                  {mainOption.hotelStars ? (
                    <p className="mt-0.5 text-sm text-[#C9A84C]">{"★".repeat(mainOption.hotelStars)}</p>
                  ) : null}
                  {commitmentNote ? <CommitmentNoteBadge note={commitmentNote} /> : null}
                  {mandatoryFeeNote ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700">⚠️ {mandatoryFeeNote}</p>
                  ) : null}
                  <PopularityBadge count={hotelPopularity[mainOption.hotelName] ?? 0} />
                </div>

                {/* Riga 3: BADGE */}
                <div style={{ ...sep, minHeight: 48, display: "flex", alignItems: "center" }}>
                  {badge ? (
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase text-white ${badgeColorClass(badge)}`}>
                      {badge}
                    </span>
                  ) : null}
                </div>

                {/* Riga 4: PERCHÉ TE LO PROPONIAMO */}
                <div style={{ ...sep, minHeight: 52 }}>
                  {hotelReason ? (
                    <>
                      <p
                        className="font-bold uppercase text-[#C9A84C]"
                        style={{ fontSize: 10, letterSpacing: "0.07em" }}
                      >
                        Perché te lo proponiamo
                      </p>
                      <p className="mt-1 text-xs italic text-[#8B7355]">{hotelReason}</p>
                    </>
                  ) : null}
                </div>

                {/* Riga 5: PREZZO DI PARTENZA */}
                <div style={sep}>
                  {minPrice != null ? (
                    <>
                      <p className="text-xs text-gray-400">a partire da</p>
                      <p className="font-bold tabular-nums text-[#1B3A5C]" style={{ fontSize: 20 }}>
                        {formatCurrency(minPrice)}
                      </p>
                    </>
                  ) : (
                    <p className="text-center text-sm text-gray-400">—</p>
                  )}
                </div>

                {/* Riga 6: TRATTAMENTI */}
                <div style={sep}>
                  {treatments.length > 0 ? (
                    <div>
                      {treatments.map((t) => (
                        <div
                          key={t.key}
                          className="flex items-center justify-between border-b border-gray-100 py-1 text-sm last:border-0 last:pb-0"
                        >
                          <span className="text-gray-600">{t.label}</span>
                          <span className="font-semibold tabular-nums text-[#1B3A5C]">{formatCurrency(t.price)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-gray-400">—</p>
                  )}
                </div>

                {/* Riga 7: SERVIZI INCLUSI */}
                <div style={sep}>
                  {services.length > 0 ? (
                    <ul className="space-y-1">
                      {services.slice(0, 4).map((s) => (
                        <li key={s} className="flex items-start gap-1.5 text-xs text-gray-600">
                          <span className="mt-0.5 flex-shrink-0 font-bold text-[#16A34A]">✓</span>
                          <span>{s}</span>
                        </li>
                      ))}
                      {services.length > 4 && (
                        <li className="text-xs text-gray-400">+{services.length - 4} altri</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>

                {/* Riga 8: BOTTONE */}
                <div style={{ ...sep, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
                  {!isConfirmed && firstTreatment ? (
                    <>
                      <button
                        className="w-full rounded-full bg-ischia-sun px-4 py-3 text-sm font-black text-ischia-navy shadow-sm transition hover:brightness-95"
                        onClick={() => setPendingSelection({ option: mainOption, treatment: firstTreatment })}
                        type="button"
                      >
                        Scegli questo hotel
                      </button>
                      <p className="mt-1 text-center text-xs leading-snug text-gray-400">
                        Nessun pagamento online — ti ricontattiamo per finalizzare
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {is3 && (
          <p className="mt-2 text-center text-xs text-gray-400 sm:hidden">
            Scorri per vedere tutte le proposte
          </p>
        )}
      </div>

      {/* Modal conferma — stessa logica di HotelCard */}
      {pendingSelection ? (
        <div
          aria-modal="true"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
          role="dialog"
        >
          <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black text-ischia-navy">Stai confermando la tua preferenza</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Il nostro staff verificherà la disponibilità definitiva della struttura scelta e ti ricontatterà per completare la prenotazione.
            </p>
            <div className="mt-4 rounded-xl bg-ischia-mist p-3 text-sm text-ischia-ink/80">
              <p><strong>Hotel:</strong> {pendingSelection.option.hotelName}</p>
              {pendingSelection.option.roomTypeLabel ? (
                <p><strong>Camera:</strong> {pendingSelection.option.roomTypeLabel}</p>
              ) : null}
              <p><strong>Trattamento:</strong> {pendingSelection.treatment.label}</p>
            </div>
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
    </>
  );
}

function HotelCard({
  mainOption,
  allGroupOptions,
  isConfirmed,
  popularity = 0,
  quoteCode,
  token,
  featureFlags,
  quote,
  onSelectTreatment
}: {
  mainOption: PublicQuoteHotelOptionDTO;
  allGroupOptions: PublicQuoteHotelOptionDTO[];
  isConfirmed: boolean;
  popularity?: number;
  quoteCode: string;
  token: string;
  featureFlags: FeatureFlags;
  quote: PublicQuoteDTO;
  onSelectTreatment: (option: PublicQuoteHotelOptionDTO, treatment: TreatmentOption) => void;
}) {
  const [pendingSelection, setPendingSelection] = useState<{ option: PublicQuoteHotelOptionDTO; treatment: TreatmentOption } | null>(null);
  const [reaction, setReaction] = useState<"interested" | "too_expensive" | null>(null);
  const reactionKey = `reaction_${quoteCode}_${mainOption.hotelGroup}`;

  useEffect(() => {
    const stored = safeSessionStorageGet(reactionKey);
    if (stored === "interested" || stored === "too_expensive") setReaction(stored);
    else setReaction(null);
  }, [reactionKey]);

  function handleReactionClick(value: "interested" | "too_expensive") {
    if (reaction === value) return;
    setReaction(value);
    safeSessionStorageSet(reactionKey, value);
    trackQuoteEvent({ quoteCode, token }, value === "interested" ? "reaction_interested" : "reaction_too_expensive", {
      hotelGroup: mainOption.hotelGroup,
      hotelName: mainOption.hotelName
    });
  }

  const services = splitLines(mainOption.includedServices);
  const stars = mainOption.hotelStars ? "★".repeat(mainOption.hotelStars) : null;
  const isAnySelected = allGroupOptions.some((o) => o.isSelected);
  const hasMultipleRoomTypes = allGroupOptions.length > 1;
  const priceScopeLabel = hasMultipleRoomTypes || quote.rooms > 1 ? "totale camera" : "totale soggiorno";
  const imageUrl = sharperWordPressImageUrl(mainOption.hotelImageUrl);
  const badge = mainOption.badge?.trim();
  const hotelReason = mainOption.hotelReason?.trim();
  const hotelNotes = buildHotelNotes(allGroupOptions, mainOption.commitmentNote);
  const mandatoryFeeNote = getMandatoryHotelFeeNote(mainOption.hotelName);
  const features = extractHighlightedFeatures({
    hotelName: mainOption.hotelName,
    includedServices: mainOption.includedServices,
    notes: mainOption.notes
  });

  return (
    <div className={`print-card overflow-hidden rounded-[30px] bg-white shadow-[0_24px_70px_rgba(8,63,115,0.11)] ring-1 ${isAnySelected ? "ring-emerald-400" : "ring-ischia-blue/10"}`}>
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-ischia-blue">{mainOption.hotelLocation}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="text-3xl font-black tracking-[-0.035em] text-ischia-navy sm:text-4xl lg:text-5xl">{mainOption.hotelName}</h3>
              {stars ? <span className="text-lg tracking-[0.12em] text-ischia-sun">{stars}</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PopularityBadge count={popularity} />
              {featureFlags.instant_reaction ? (
                <>
                  <button
                    className={`no-print rounded-full border px-3 py-1.5 text-xs font-black transition ${reaction === "interested" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-500 bg-white text-emerald-700"}`}
                    onClick={() => handleReactionClick("interested")}
                    type="button"
                  >
                    👍 Mi interessa
                  </button>
                  <button
                    className={`no-print rounded-full border px-3 py-1.5 text-xs font-black transition ${reaction === "too_expensive" ? "border-rose-600 bg-rose-600 text-white" : "border-rose-400 bg-white text-rose-600"}`}
                    onClick={() => handleReactionClick("too_expensive")}
                    type="button"
                  >
                    💸 Troppo caro
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {mainOption.sourceUrl ? (
            <a
              className="no-print shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-blue ring-1 ring-ischia-blue/20"
              href={mainOption.sourceUrl}
              onClick={() => trackQuoteEvent({ quoteCode, token }, "hotel_link_clicked", {
                hotelOptionId: mainOption.id,
                hotelName: mainOption.hotelName,
                sourceUrl: mainOption.sourceUrl
              })}
              rel="noopener noreferrer"
              target="_blank"
            >
              Vedi l&apos;hotel →
            </a>
          ) : null}
        </div>

        {hotelReason ? (
          <div className="mt-5 rounded-[20px] border border-[#E4C46C] bg-[#FFF8E8] px-5 py-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0BD] text-lg">★</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#B88716]">Perché te lo proponiamo</p>
                <p className="mt-1 text-sm leading-6 text-ischia-ink/75">{hotelReason}</p>
              </div>
            </div>
          </div>
        ) : null}

        {mandatoryFeeNote ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <strong>Da pagare in loco:</strong> {mandatoryFeeNote}
          </div>
        ) : null}

        {features.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-ischia-navy">Plus inclusi</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {features.map((feature) => (
                <span key={feature} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200/70">
                  ✓ {feature}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {services.length > 0 ? (
          <div className="mt-5 rounded-[22px] bg-[#F2F8FC] p-5 ring-1 ring-ischia-blue/10">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-ischia-blue">Servizi inclusi</p>
            <ul className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {services.map((service) => (
                <li key={service} className="flex items-center gap-3 text-sm font-semibold text-ischia-ink/78">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ischia-blue ring-1 ring-ischia-blue/10">
                    <ServiceIcon service={service} />
                  </span>
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hotelNotes.notes.length > 0 || hotelNotes.commitmentNote ? (
          <div className="mt-4 rounded-[20px] bg-ischia-navy px-5 py-4 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg">▤</span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.13em] text-white">Note struttura / camera</p>
                {hotelNotes.notes.length > 0 ? (
                  <div className="mt-2 space-y-1 text-sm leading-6 text-white/95">
                    {hotelNotes.notes.map((note) => <p key={note}>{note}</p>)}
                  </div>
                ) : null}
                {hotelNotes.commitmentNote ? (
                  <p className="mt-2 border-l-2 border-ischia-sun pl-3 text-sm font-semibold leading-6 text-white">
                    {hotelNotes.commitmentNote}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 bg-[#FBFDFE] px-5 pb-6 sm:px-7 sm:pb-8">
        {allGroupOptions.map((opt) => {
          const activeTreatments = visibleTreatments(opt);
          return (
            <div key={opt.id} className="space-y-4">
              {activeTreatments.map((treatment, treatmentIndex) => {
                const details = treatmentDetails(opt, treatment);
                const frontDetails = details || treatmentDescription(treatment);
                const previous = activeTreatments[treatmentIndex - 1];
                const delta = previous ? treatment.price - previous.price : null;
                const roomImage = opt.roomImageUrl || imageUrl;
                const previewRoomImage = quote.token === "preview-demo-token" && !opt.roomImageUrl
                  ? treatment.key === "full_board"
                    ? "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=85"
                    : "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85"
                  : roomImage;

                return (
                  <div key={`${opt.id}-${treatment.key}`} className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(8,63,115,0.08)] ring-1 ring-ischia-blue/10">
                    <div className="grid lg:grid-cols-[330px_minmax(0,1fr)_270px]">
                      <div className="relative min-h-[245px] overflow-hidden bg-ischia-mist">
                        {previewRoomImage ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewRoomImage} alt={opt.roomTypeLabel || mainOption.hotelName} className="absolute inset-0 h-full w-full object-cover object-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                          </>
                        ) : (
                          <div className="flex h-full min-h-[245px] items-center justify-center"><BuildingIcon /></div>
                        )}
                        <span className={`absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black shadow-sm ${treatmentIndex === 0 ? "text-emerald-700 ring-1 ring-emerald-200" : "text-amber-700 ring-1 ring-amber-200"}`}>
                          {treatmentIndex === 0 ? "Più economica" : "Più completa"}
                        </span>
                      </div>

                      <div className="p-5 sm:p-6">
                        {opt.roomTypeLabel ? (
                          <p className="text-xs font-black uppercase tracking-[0.13em] text-ischia-blue/70">{opt.roomTypeLabel}</p>
                        ) : null}
                        <h4 className="mt-1 text-3xl font-black tracking-[-0.03em] text-ischia-navy">{treatment.label}</h4>
                        <p className="mt-4 text-xs font-black uppercase tracking-[0.13em] text-ischia-blue/70">Cosa include</p>
                        <ul className="mt-3 space-y-2">
                          {frontDetails.split(",").map((item) => item.trim()).filter(Boolean).map((item) => (
                            <li key={item} className="flex gap-2 text-sm leading-5 text-ischia-ink/80">
                              <span className="font-black text-emerald-600">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-col justify-center bg-[#F5FAFD] p-5 sm:p-6">
                        <p className="text-xs font-black uppercase tracking-[0.13em] text-ischia-blue/70">{priceScopeLabel}</p>
                        <p className="mt-1 text-5xl font-black tabular-nums tracking-[-0.045em] text-ischia-navy">{formatCurrency(treatment.price)}</p>
                        {delta && delta > 0 ? (
                          <p className="mt-2 text-sm font-semibold text-ischia-ink/60">+ {formatCurrency(delta)} rispetto all&apos;opzione precedente</p>
                        ) : null}

                        {!isConfirmed ? (
                          <div className="no-print mt-5">
                            <button
                              className="w-full rounded-full bg-ischia-sun px-5 py-3.5 text-sm font-black text-ischia-navy shadow-sm transition hover:brightness-95"
                              onClick={() => setPendingSelection({ option: opt, treatment })}
                              type="button"
                            >
                              Scegli questa proposta →
                            </button>
                            <p className="mt-3 text-center text-xs leading-5 text-ischia-ink/45">Nessun pagamento online — ti ricontattiamo per finalizzare</p>
                          </div>
                        ) : null}

                        {isConfirmed && opt.isSelected ? (
                          <span className="mt-4 rounded-full bg-emerald-100 px-3 py-2 text-center text-xs font-black text-emerald-800">Confermato</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {pendingSelection ? (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" role="dialog" aria-modal="true">
          <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black text-ischia-navy">Aggiungi questa camera</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Il nostro staff verificherà la disponibilità definitiva della struttura scelta e ti ricontatterà per completare la prenotazione.
            </p>
            <div className="mt-4 rounded-xl bg-ischia-mist p-3 text-sm text-ischia-ink/80">
              <p><strong>Hotel:</strong> {pendingSelection.option.hotelName}</p>
              {pendingSelection.option.roomTypeLabel ? <p><strong>Camera:</strong> {pendingSelection.option.roomTypeLabel}</p> : null}
              <p><strong>Trattamento:</strong> {pendingSelection.treatment.label}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => setPendingSelection(null)} type="button">
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
                Sì, aggiungi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TreatmentDetails({ option, treatment, details, className }: { option: PublicQuoteHotelOptionDTO; treatment: TreatmentOption; details?: string; className?: string }) {
  const services = splitLines(option.includedServices);
  const breakdown = calculatePaymentBreakdown(treatment.price, option.depositPercent, option.balanceMethod || BALANCE_METHOD_IN_STRUCTURE);
  const hasDetails = services.length > 0 || option.paymentPolicy || option.cancellationPolicy || option.paymentNotes || option.notes || breakdown.depositPercent > 0;

  return (
    <div className={`mt-3 rounded-xl bg-white/85 p-4 text-sm leading-6 text-ischia-ink/78 ring-1 ring-ischia-blue/10 ${className ?? ""}`}>
      <p className="font-black text-ischia-navy">Cosa include questa opzione</p>
      <div className="mt-2 grid gap-1">
        <p><strong>Hotel:</strong> {option.hotelName}</p>
        {option.roomTypeLabel ? <p><strong>Camera:</strong> {option.roomTypeLabel}</p> : null}
        <p><strong>Trattamento:</strong> {treatment.label}</p>
        <p><strong>Prezzo:</strong> {formatCurrency(treatment.price)}</p>
        {breakdown.depositPercent > 0 ? (
          <>
            <p><strong>Acconto richiesto:</strong> {breakdown.depositPercent}% pari a {formatCurrency(breakdown.depositAmount)}</p>
            <p><strong>Saldo restante:</strong> {formatCurrency(breakdown.balanceAmount)} {breakdown.balanceMethod.replace(/^Saldo restante\s*/i, "").replace(/\.$/, "")}.</p>
          </>
        ) : null}
        <p>{treatmentDescription(treatment)}</p>
        {details ? <p className="whitespace-pre-line">{details}</p> : null}
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
      {option.paymentNotes ? <p className="mt-2 rounded-lg bg-ischia-navy px-3 py-2 text-white"><strong>Note pagamento:</strong> {option.paymentNotes}</p> : null}
      {option.cancellationPolicy ? <p className="mt-2"><strong>Politiche di cancellazione:</strong> {option.cancellationPolicy}</p> : null}
      {option.notes ? <p className="mt-2 rounded-lg bg-ischia-navy px-3 py-2 text-white"><strong>Note:</strong> {option.notes}</p> : null}
      {!hasDetails ? (
        <p className="mt-3">I dettagli completi verranno confermati dal nostro staff in fase di prenotazione.</p>
      ) : null}
      <p className="mt-3 text-xs font-semibold text-ischia-ink/65">
        La proposta è soggetta a disponibilità al momento della conferma definitiva.
      </p>
    </div>
  );
}
