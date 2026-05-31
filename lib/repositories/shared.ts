import { hotels } from "@/lib/mock-data";
import { Hotel, Quote, QuoteHotelOption, QuoteStatus, TransportOffer, TreatmentOption } from "@/lib/types";

export type DataSource = "supabase" | "mock";

export type RepositoryResult<T> = {
  data: T;
  source: DataSource;
  error?: string;
};

export function fallback<T>(data: T, error?: unknown): RepositoryResult<T> {
  return {
    data,
    source: "mock",
    error: serializeRepositoryError(error)
  };
}

export function fromSupabase<T>(data: T): RepositoryResult<T> {
  return { data, source: "supabase" };
}

export function mapHotel(row: Record<string, unknown>): Hotel {
  return {
    id: String(row.id),
    name: String(row.name),
    zone: String(row.location ?? row.zone ?? ""),
    stars: Number(row.stars ?? 3),
    description: String(row.short_description ?? row.description ?? ""),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    externalImageUrl: row.external_image_url ? String(row.external_image_url) : undefined,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    slug: row.slug ? String(row.slug) : undefined,
    standardServices: Array.isArray(row.standard_services) ? row.standard_services as string[] : [],
    defaultDepositPercent: row.default_deposit_percent != null ? Number(row.default_deposit_percent) : undefined,
    defaultBalanceMethod: row.default_balance_method ? String(row.default_balance_method) : undefined,
    defaultPaymentNotes: row.default_payment_notes ? String(row.default_payment_notes) : undefined,
    paymentPolicy: String(row.payment_policy ?? ""),
    cancellationPolicy: String(row.cancellation_policy ?? ""),
    internalNotes: String(row.internal_notes ?? ""),
    active: Boolean(row.is_active ?? row.active ?? true)
  };
}

export function mapQuote(
  row: Record<string, unknown>,
  allHotels: Hotel[],
  childRows: Record<string, unknown>[] = [],
  hotelOptions: QuoteHotelOption[] = [],
  confirmationRow?: Record<string, unknown> | null
): Quote {
  const proposedHotel = allHotels.find((h) => h.id === (row.hotel_id ?? row.proposed_hotel_id)) ?? hotels[0];
  const alternativeHotel = allHotels.find((h) => h.id === row.alternative_hotel_id);
  const children = childRows
    .filter((c) => c.quote_id === row.id)
    .map((c, index) => ({
      id: String(c.id ?? `${row.id}-child-${index}`),
      firstName: String(c.first_name ?? `Bambino ${index + 1}`),
      birthDate: String(c.birth_date)
    }));

  // hotelOptions già mappati da fetchHotelOptionsForQuotes; se vuoti, crea opzione virtuale legacy
  const effectiveHotelOptions: QuoteHotelOption[] = hotelOptions.length > 0
    ? [...hotelOptions].sort((a, b) => a.position - b.position)
    : buildVirtualHotelOptions(row, proposedHotel);

  return {
    id: String(row.id),
    code: String(row.code),
    token: String(row.public_token),
    requestId: String(row.quote_request_id ?? ""),
    customerFirstName: String(row.client_first_name ?? row.customer_first_name ?? ""),
    customerLastName: String(row.client_last_name ?? row.customer_last_name ?? ""),
    customerEmail: String(row.client_email ?? row.customer_email ?? ""),
    customerPhone: String(row.client_phone ?? row.customer_phone ?? ""),
    requestedHotel: String(row.hotel_requested ?? row.requested_hotel ?? ""),
    proposedHotel,
    alternativeHotel,
    isAlternative: Boolean(row.is_alternative_offer ?? row.unavailable_requested_hotel ?? false),
    unavailableRequestedHotel: Boolean(row.is_alternative_offer ?? row.unavailable_requested_hotel ?? false),
    arrivalDate: String(row.check_in ?? row.arrival_date ?? ""),
    departureDate: String(row.check_out ?? row.departure_date ?? ""),
    adults: Number(row.adults ?? 2),
    children,
    rooms: Number(row.rooms ?? 1),
    treatment: String(row.treatment ?? ""),
    totalPrice: Number(row.total_price ?? 0),
    deposit: Number(row.deposit_amount ?? row.deposit ?? 0),
    offerExpiresAt: String(row.valid_until ?? row.offer_expires_at ?? ""),
    servicesIncluded: Array.isArray(row.included_services)
      ? row.included_services as string[]
      : Array.isArray(row.services_included)
        ? row.services_included as string[]
        : [],
    transportOffers: parseTransportOffers(row.transport_offers ?? (row.metadata as Record<string, unknown> | undefined)?.transport_offers),
    paymentPolicy: String(row.payment_policy ?? ""),
    cancellationPolicy: String(row.cancellation_policy ?? ""),
    internalNotes: String(row.internal_notes ?? ""),
    customerNotes: String(row.public_notes ?? row.customer_notes ?? ""),
    status: normalizeStatus(String(row.status ?? "da_evadere")),
    createdAt: String(row.created_at ?? ""),
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    excludedFromStats: Boolean(row.excluded_from_stats ?? false),
    deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
    confirmation: row.confirmed_at || confirmationRow
      ? {
          confirmedAt: String(confirmationRow?.created_at ?? row.confirmed_at ?? ""),
          fiscalCode: String(confirmationRow?.fiscal_code ?? ""),
          address: String(confirmationRow?.address ?? ""),
          city: String(confirmationRow?.city ?? ""),
          zip: String(confirmationRow?.postal_code ?? ""),
          province: String(confirmationRow?.province ?? ""),
          selectedHotelOptionId: confirmationRow?.selected_hotel_option_id ? String(confirmationRow.selected_hotel_option_id) : undefined,
          selectedHotelName: confirmationRow?.selected_hotel_name ? String(confirmationRow.selected_hotel_name) : undefined,
          selectedTreatmentKey: confirmationRow?.selected_treatment_key ? String(confirmationRow.selected_treatment_key) : undefined,
          selectedTreatmentLabel: confirmationRow?.selected_treatment_label ? String(confirmationRow.selected_treatment_label) : undefined,
          selectedPrice: confirmationRow?.selected_price != null ? Number(confirmationRow.selected_price) : undefined,
          selectedDepositPercent: confirmationRow?.selected_deposit_percent != null ? Number(confirmationRow.selected_deposit_percent) : undefined,
          selectedDepositAmount: confirmationRow?.selected_deposit_amount != null ? Number(confirmationRow.selected_deposit_amount) : undefined,
          selectedBalanceAmount: confirmationRow?.selected_balance_amount != null ? Number(confirmationRow.selected_balance_amount) : undefined,
          selectedBalanceMethod: confirmationRow?.selected_balance_method ? String(confirmationRow.selected_balance_method) : undefined,
          selectedPaymentPolicy: confirmationRow?.selected_payment_policy ? String(confirmationRow.selected_payment_policy) : undefined,
          selectedCancellationPolicy: confirmationRow?.selected_cancellation_policy ? String(confirmationRow.selected_cancellation_policy) : undefined,
          paymentSettingsSnapshot: typeof confirmationRow?.payment_settings_snapshot === "object" && confirmationRow.payment_settings_snapshot
            ? confirmationRow.payment_settings_snapshot as Record<string, unknown>
            : undefined
        }
      : undefined,
    hotelOptions: effectiveHotelOptions
  };
}

function mapHotelOptionRowInline(row: Record<string, unknown>): QuoteHotelOption {
  const breakfastPrice = row.breakfast_price != null ? Number(row.breakfast_price) : undefined;
  const halfBoardPrice = row.half_board_price != null ? Number(row.half_board_price) : undefined;
  const fullBoardPrice = row.full_board_price != null ? Number(row.full_board_price) : undefined;
  const breakfastLabel = String(row.breakfast_label ?? "Camera e colazione");
  const halfBoardLabel = String(row.half_board_label ?? "Mezza pensione");
  const fullBoardLabel = String(row.full_board_label ?? "Pensione completa");

  const treatments: TreatmentOption[] = [
    breakfastPrice != null ? { key: "breakfast" as const, label: breakfastLabel, price: breakfastPrice } : null,
    halfBoardPrice != null ? { key: "half_board" as const, label: halfBoardLabel, price: halfBoardPrice } : null,
    fullBoardPrice != null ? { key: "full_board" as const, label: fullBoardLabel, price: fullBoardPrice } : null
  ].filter(Boolean) as TreatmentOption[];

  return {
    id: String(row.id),
    quoteId: String(row.quote_id),
    hotelId: row.hotel_id ? String(row.hotel_id) : undefined,
    hotelGroup: row.hotel_group != null ? Number(row.hotel_group) : 1,
    position: Number(row.position),
    roomTypeLabel: row.room_type_label ? String(row.room_type_label) : undefined,
    hotelName: String(row.hotel_name),
    hotelLocation: row.hotel_location ? String(row.hotel_location) : undefined,
    hotelStars: row.hotel_stars != null ? Number(row.hotel_stars) : undefined,
    hotelImageUrl: row.hotel_image_url ? String(row.hotel_image_url) : undefined,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    breakfastPrice,
    halfBoardPrice,
    fullBoardPrice,
    breakfastLabel,
    halfBoardLabel,
    fullBoardLabel,
    includedServices: row.included_services ? String(row.included_services) : undefined,
    depositPercent: row.deposit_percent != null ? Number(row.deposit_percent) : undefined,
    balanceMethod: row.balance_method ? String(row.balance_method) : undefined,
    paymentPolicy: row.payment_policy ? String(row.payment_policy) : undefined,
    cancellationPolicy: row.cancellation_policy ? String(row.cancellation_policy) : undefined,
    paymentNotes: row.payment_notes ? String(row.payment_notes) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    isSelected: Boolean(row.is_selected),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    treatments
  };
}

// Crea un'opzione virtuale per preventivi vecchi (schema legacy)
function buildVirtualHotelOptions(row: Record<string, unknown>, proposedHotel: Hotel): QuoteHotelOption[] {
  const totalPrice = Number(row.total_price ?? 0);
  const treatment = String(row.treatment ?? "").trim().toLowerCase();

  const isHalf = ["mezza pensione", "half board"].includes(treatment);
  const isFull = ["pensione completa", "full board"].includes(treatment);

  const breakfastPrice = !isHalf && !isFull ? (totalPrice > 0 ? totalPrice : undefined) : undefined;
  const halfBoardPrice = isHalf ? totalPrice : undefined;
  const fullBoardPrice = isFull ? totalPrice : undefined;

  const treatments: TreatmentOption[] = [
    breakfastPrice != null ? { key: "breakfast" as const, label: "Camera e colazione", price: breakfastPrice } : null,
    halfBoardPrice != null ? { key: "half_board" as const, label: "Mezza pensione", price: halfBoardPrice } : null,
    fullBoardPrice != null ? { key: "full_board" as const, label: "Pensione completa", price: fullBoardPrice } : null
  ].filter(Boolean) as TreatmentOption[];

  const quoteId = String(row.id);
  const createdAt = String(row.created_at ?? "");

  return [
    {
      id: `virtual-${quoteId}-1`,
      quoteId,
      hotelId: undefined,
      hotelGroup: 1,
      position: 1,
      roomTypeLabel: undefined,
      hotelName: proposedHotel.name,
      hotelLocation: proposedHotel.zone,
      hotelStars: proposedHotel.stars,
      hotelImageUrl: proposedHotel.imageUrl ?? proposedHotel.externalImageUrl,
      sourceUrl: proposedHotel.sourceUrl,
      breakfastPrice,
      halfBoardPrice,
      fullBoardPrice,
      breakfastLabel: "Camera e colazione",
      halfBoardLabel: "Mezza pensione",
      fullBoardLabel: "Pensione completa",
      includedServices: proposedHotel.standardServices.join("\n"),
      depositPercent: proposedHotel.defaultDepositPercent,
      balanceMethod: proposedHotel.defaultBalanceMethod,
      paymentPolicy: proposedHotel.paymentPolicy,
      cancellationPolicy: proposedHotel.cancellationPolicy,
      paymentNotes: proposedHotel.defaultPaymentNotes,
      notes: undefined,
      isSelected: false,
      createdAt,
      updatedAt: createdAt,
      treatments
    }
  ];
}

export function getEffectiveHotelOptions(quote: { hotelOptions: QuoteHotelOption[]; proposedHotel: Hotel; treatment: string; totalPrice: number; id: string; createdAt: string }): QuoteHotelOption[] {
  if (quote.hotelOptions.length > 0) return quote.hotelOptions;

  // Fallback per preventivi demo senza hotelOptions (es. mock-data.ts)
  const treatment = quote.treatment.trim().toLowerCase();
  const isHalf = ["mezza pensione", "half board"].includes(treatment);
  const isFull = ["pensione completa", "full board"].includes(treatment);
  const price = quote.totalPrice > 0 ? quote.totalPrice : undefined;

  const breakfastPrice = !isHalf && !isFull ? price : undefined;
  const halfBoardPrice = isHalf ? price : undefined;
  const fullBoardPrice = isFull ? price : undefined;

  const treatments: TreatmentOption[] = [
    breakfastPrice != null ? { key: "breakfast" as const, label: "Camera e colazione", price: breakfastPrice } : null,
    halfBoardPrice != null ? { key: "half_board" as const, label: "Mezza pensione", price: halfBoardPrice } : null,
    fullBoardPrice != null ? { key: "full_board" as const, label: "Pensione completa", price: fullBoardPrice } : null
  ].filter(Boolean) as TreatmentOption[];

  return [
    {
      id: `virtual-${quote.id}-1`,
      quoteId: quote.id,
      hotelId: undefined,
      hotelGroup: 1,
      position: 1,
      roomTypeLabel: undefined,
      hotelName: quote.proposedHotel.name,
      hotelLocation: quote.proposedHotel.zone,
      hotelStars: quote.proposedHotel.stars,
      hotelImageUrl: quote.proposedHotel.imageUrl ?? quote.proposedHotel.externalImageUrl,
      sourceUrl: quote.proposedHotel.sourceUrl,
      breakfastPrice,
      halfBoardPrice,
      fullBoardPrice,
      breakfastLabel: "Camera e colazione",
      halfBoardLabel: "Mezza pensione",
      fullBoardLabel: "Pensione completa",
      includedServices: quote.proposedHotel.standardServices.join("\n"),
      depositPercent: quote.proposedHotel.defaultDepositPercent,
      balanceMethod: quote.proposedHotel.defaultBalanceMethod,
      paymentPolicy: quote.proposedHotel.paymentPolicy,
      cancellationPolicy: quote.proposedHotel.cancellationPolicy,
      paymentNotes: quote.proposedHotel.defaultPaymentNotes,
      notes: undefined,
      isSelected: false,
      createdAt: quote.createdAt,
      updatedAt: quote.createdAt,
      treatments
    }
  ];
}

function parseTransportOffers(value: unknown): TransportOffer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const offer = item as Partial<TransportOffer>;
      if (!offer.title && !offer.description) return null;
      return {
        id: offer.id ?? `transport-${index}`,
        type: offer.type === "ferry" || offer.type === "hydrofoil" || offer.type === "train" ? offer.type : "ferry",
        title: offer.title ?? "Offerta trasporto",
        description: offer.description ?? "",
        price: typeof offer.price === "number" ? offer.price : undefined,
        notes: offer.notes
      };
    })
    .filter(Boolean) as TransportOffer[];
}

export function normalizeStatus(status: string): QuoteStatus {
  if (status === "perso" || status === "non_disponibile") return "perso_non_disponibile";
  if (status === "aperto") return "preventivo_inviato";
  if (["da_evadere", "in_lavorazione", "preventivo_inviato", "confermato", "perso_non_disponibile"].includes(status)) return status as QuoteStatus;
  return "da_evadere";
}

function serializeRepositoryError(error?: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown; details?: unknown };
    const message = typeof record.message === "string" ? record.message : undefined;
    const code = typeof record.code === "string" && record.code ? ` (${record.code})` : "";
    const details = typeof record.details === "string" && record.details && record.details !== message ? `: ${record.details}` : "";
    return message ? `${message}${code}${details}` : "Errore repository";
  }
  return undefined;
}
