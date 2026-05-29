import { hotels } from "@/lib/mock-data";
import { Hotel, Quote, QuoteStatus, TransportOffer } from "@/lib/types";

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

export function mapHotel(row: Record<string, any>): Hotel {
  return {
    id: row.id,
    name: row.name,
    zone: row.location ?? row.zone ?? "",
    stars: row.stars ?? 3,
    description: row.short_description ?? row.description ?? "",
    imageUrl: row.image_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    slug: row.slug ?? undefined,
    standardServices: Array.isArray(row.standard_services) ? row.standard_services : [],
    paymentPolicy: row.payment_policy ?? "",
    cancellationPolicy: row.cancellation_policy ?? "",
    internalNotes: row.internal_notes ?? "",
    active: row.is_active ?? row.active ?? true
  };
}

export function mapQuote(row: Record<string, any>, allHotels: Hotel[], childRows: Record<string, any>[] = []): Quote {
  const proposedHotel = allHotels.find((hotel) => hotel.id === (row.hotel_id ?? row.proposed_hotel_id)) ?? hotels[0];
  const alternativeHotel = allHotels.find((hotel) => hotel.id === row.alternative_hotel_id);
  const children = childRows
    .filter((child) => child.quote_id === row.id)
    .map((child, index) => ({
      id: child.id ?? `${row.id}-child-${index}`,
      firstName: child.first_name ?? `Bambino ${index + 1}`,
      birthDate: child.birth_date
    }));

  return {
    id: row.id,
    code: row.code,
    token: row.public_token,
    requestId: row.quote_request_id ?? "",
    customerFirstName: row.client_first_name ?? row.customer_first_name,
    customerLastName: row.client_last_name ?? row.customer_last_name,
    customerEmail: row.client_email ?? row.customer_email,
    customerPhone: row.client_phone ?? row.customer_phone,
    requestedHotel: row.hotel_requested ?? row.requested_hotel ?? "",
    proposedHotel,
    alternativeHotel,
    isAlternative: row.is_alternative_offer ?? row.unavailable_requested_hotel ?? false,
    unavailableRequestedHotel: row.is_alternative_offer ?? row.unavailable_requested_hotel ?? false,
    arrivalDate: row.check_in ?? row.arrival_date,
    departureDate: row.check_out ?? row.departure_date,
    adults: row.adults ?? 2,
    children,
    rooms: row.rooms ?? 1,
    treatment: row.treatment ?? "",
    totalPrice: Number(row.total_price ?? 0),
    deposit: Number(row.deposit_amount ?? row.deposit ?? 0),
    offerExpiresAt: row.valid_until ?? row.offer_expires_at,
    servicesIncluded: Array.isArray(row.included_services) ? row.included_services : Array.isArray(row.services_included) ? row.services_included : [],
    transportOffers: parseTransportOffers(row.transport_offers ?? row.metadata?.transport_offers),
    paymentPolicy: row.payment_policy ?? "",
    cancellationPolicy: row.cancellation_policy ?? "",
    internalNotes: row.internal_notes ?? "",
    customerNotes: row.public_notes ?? row.customer_notes ?? "",
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
    excludedFromStats: row.excluded_from_stats ?? false,
    deletedAt: row.deleted_at ?? undefined,
    confirmation: row.confirmed_at
      ? {
          confirmedAt: row.confirmed_at,
          fiscalCode: "",
          address: "",
          city: "",
          zip: "",
          province: ""
        }
      : undefined
  };
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
