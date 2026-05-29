import { hotels } from "@/lib/mock-data";
import { addDemoQuote, allDemoQuotes, excludeDemoQuoteFromStats, isQuoteConfirmedInDemo, markQuoteConfirmed as markDemoQuoteConfirmed, restoreDemoQuote, softDeleteDemoQuote, updateDemoQuote } from "@/lib/demo-store";
import { listHotels } from "@/lib/repositories/hotels";
import { createQuoteStatusEvent } from "@/lib/repositories/quoteStatusEvents";
import { fallback, fromSupabase, mapQuote, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient, createSupabaseAuthenticatedClient } from "@/lib/supabase/admin";
import { Quote, QuoteStatus, TransportOffer } from "@/lib/types";

export type QuoteInput = {
  quoteRequestId?: string;
  code?: string;
  publicToken?: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  hotelRequested?: string;
  hotelId?: string;
  alternativeHotelId?: string;
  isAlternativeOffer?: boolean;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: { birthDate: string }[];
  rooms: number;
  treatment?: string;
  totalPrice: number;
  depositAmount: number;
  validUntil?: string;
  includedServices?: string[];
  transportOffers?: TransportOffer[];
  paymentPolicy?: string;
  cancellationPolicy?: string;
  publicNotes?: string;
  internalNotes?: string;
};

export async function listQuotes({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<RepositoryResult<Quote[]>> {
  const supabase = createSupabaseAdminClient();
  const demoQuotes = includeDeleted ? allDemoQuotes() : allDemoQuotes().filter((q) => !q.deletedAt);
  if (!supabase) return fallback(demoQuotes);

  const hotelResult = await listHotels();
  let query = supabase.from("quotes").select("*").order("created_at", { ascending: false });
  if (!includeDeleted) query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) return fallback(demoQuotes, error);

  const quoteIds = (data ?? []).map((row) => row.id);
  const { data: childRows } = quoteIds.length ? await supabase.from("quote_children").select("*").in("quote_id", quoteIds) : { data: [] };
  return fromSupabase((data ?? []).map((row) => withDemoStatus(mapQuote(row, hotelResult.data.length ? hotelResult.data : hotels, childRows ?? []))));
}

export async function getQuoteByCodeAndToken(code: string, token?: string): Promise<RepositoryResult<Quote | null>> {
  const local = allDemoQuotes().find((quote) => quote.code === code && quote.token === token) ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase || !token) return fallback(local);

  const { data, error } = await supabase.from("quotes").select("*").eq("code", code).eq("public_token", token).maybeSingle();
  if (error || !data) return error ? fallback(local, error) : fromSupabase(null);

  const hotelResult = await listHotels();
  const { data: childRows } = await supabase.from("quote_children").select("*").eq("quote_id", data.id);
  return fromSupabase(withDemoStatus(mapQuote(data, hotelResult.data.length ? hotelResult.data : hotels, childRows ?? [])));
}

export async function getQuoteById(id: string): Promise<RepositoryResult<Quote | null>> {
  const local = allDemoQuotes().find((quote) => quote.id === id) ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (error) return fallback(local, error);
  if (!data) return fromSupabase(null);

  const hotelResult = await listHotels();
  const { data: childRows } = await supabase.from("quote_children").select("*").eq("quote_id", data.id);
  return fromSupabase(withDemoStatus(mapQuote(data, hotelResult.data.length ? hotelResult.data : hotels, childRows ?? [])));
}

export async function createQuoteFromRequest(input: QuoteInput, options: { accessToken?: string } = {}): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAuthenticatedClient(options.accessToken) ?? createSupabaseAdminClient();
  const normalizedInput = { ...input, code: input.code ?? await nextQuoteCode(supabase ?? undefined), publicToken: input.publicToken ?? secureToken() };
  if (!supabase) {
    const hotelResult = await listHotels();
    const proposedHotel = hotelResult.data.find((hotel) => hotel.id === normalizedInput.hotelId) ?? hotelResult.data[0] ?? hotels[0];
    const alternativeHotel = hotelResult.data.find((hotel) => hotel.id === normalizedInput.alternativeHotelId);
    const quote: Quote = {
      id: `quote-local-${Date.now()}`,
      code: normalizedInput.code,
      token: normalizedInput.publicToken,
      requestId: normalizedInput.quoteRequestId ?? "",
      customerFirstName: normalizedInput.clientFirstName,
      customerLastName: normalizedInput.clientLastName,
      customerEmail: normalizedInput.clientEmail,
      customerPhone: normalizedInput.clientPhone,
      requestedHotel: normalizedInput.hotelRequested ?? "",
      proposedHotel,
      alternativeHotel,
      isAlternative: Boolean(normalizedInput.isAlternativeOffer),
      unavailableRequestedHotel: Boolean(normalizedInput.isAlternativeOffer),
      arrivalDate: normalizedInput.checkIn,
      departureDate: normalizedInput.checkOut,
      adults: normalizedInput.adults,
      children: (normalizedInput.children ?? []).map((child, index) => ({ id: `child-local-${Date.now()}-${index}`, firstName: `Bambino ${index + 1}`, birthDate: child.birthDate })),
      rooms: normalizedInput.rooms,
      treatment: normalizedInput.treatment ?? "",
      totalPrice: normalizedInput.totalPrice,
      deposit: normalizedInput.depositAmount,
      offerExpiresAt: normalizedInput.validUntil ?? new Date().toISOString().slice(0, 10),
      servicesIncluded: normalizedInput.includedServices ?? proposedHotel.standardServices,
      transportOffers: normalizedInput.transportOffers ?? [],
      paymentPolicy: normalizedInput.paymentPolicy ?? proposedHotel.paymentPolicy,
      cancellationPolicy: normalizedInput.cancellationPolicy ?? proposedHotel.cancellationPolicy,
      internalNotes: normalizedInput.internalNotes ?? "",
      customerNotes: normalizedInput.publicNotes ?? "",
      status: "preventivo_inviato",
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      excludedFromStats: false
    };
    addDemoQuote(quote);
    await createQuoteStatusEvent({
      quoteId: quote.id,
      fromStatus: null,
      toStatus: quote.status,
      note: "Preventivo creato"
    });
    return fallback(quote);
  }

  const row = toQuoteRow(normalizedInput);
  const { data, error } = await supabase.from("quotes").insert(row).select("*").single();
  if (error) return fallback(null, error);

  await createQuoteStatusEvent({
    quoteId: data.id,
    fromStatus: null,
    toStatus: "preventivo_inviato",
    note: "Preventivo creato"
  });

  if (normalizedInput.children?.length) {
    await supabase.from("quote_children").insert(normalizedInput.children.map((child) => ({ quote_id: data.id, birth_date: child.birthDate })));
  }

  const hotelResult = await listHotels();
  const { data: childRows } = await supabase.from("quote_children").select("*").eq("quote_id", data.id);
  return fromSupabase(withDemoStatus(mapQuote(data, hotelResult.data.length ? hotelResult.data : hotels, childRows ?? [])));
}

async function nextQuoteCode(supabase?: ReturnType<typeof createSupabaseAdminClient>): Promise<string> {
  const year = new Date().getFullYear();
  if (supabase) {
    const { data } = await supabase
      .from("quotes")
      .select("code")
      .like("code", `IS-${year}-%`)
      .order("code", { ascending: false })
      .limit(1)
      .maybeSingle();
    const match = (data as { code?: string } | null)?.code?.match(/^IS-\d{4}-(\d+)$/);
    return `IS-${year}-${String((match ? Number(match[1]) : 0) + 1).padStart(3, "0")}`;
  }
  const max = allDemoQuotes().reduce((current, quote) => {
    const match = quote.code.match(/^IS-\d{4}-(\d+)$/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `IS-${year}-${String(max + 1).padStart(3, "0")}`;
}

function secureToken() {
  return `tok-${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function updateQuote(id: string, input: Partial<QuoteInput>): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const hotelResult = await listHotels();
    const updated = updateDemoQuote(id, (quote) => {
      const proposedHotel = input.hotelId ? hotelResult.data.find((hotel) => hotel.id === input.hotelId) ?? quote.proposedHotel : quote.proposedHotel;
      const alternativeHotel = input.alternativeHotelId ? hotelResult.data.find((hotel) => hotel.id === input.alternativeHotelId) : quote.alternativeHotel;
      return {
        ...quote,
        customerFirstName: input.clientFirstName ?? quote.customerFirstName,
        customerLastName: input.clientLastName ?? quote.customerLastName,
        customerEmail: input.clientEmail ?? quote.customerEmail,
        customerPhone: input.clientPhone ?? quote.customerPhone,
        requestedHotel: input.hotelRequested ?? quote.requestedHotel,
        proposedHotel,
        alternativeHotel,
        isAlternative: input.isAlternativeOffer ?? quote.isAlternative,
        unavailableRequestedHotel: input.isAlternativeOffer ?? quote.unavailableRequestedHotel,
        arrivalDate: input.checkIn ?? quote.arrivalDate,
        departureDate: input.checkOut ?? quote.departureDate,
        adults: input.adults ?? quote.adults,
        rooms: input.rooms ?? quote.rooms,
        treatment: input.treatment ?? quote.treatment,
        totalPrice: input.totalPrice ?? quote.totalPrice,
        deposit: input.depositAmount ?? quote.deposit,
        offerExpiresAt: input.validUntil ?? quote.offerExpiresAt,
        servicesIncluded: input.includedServices ?? quote.servicesIncluded,
        transportOffers: input.transportOffers ?? quote.transportOffers,
        paymentPolicy: input.paymentPolicy ?? quote.paymentPolicy,
        cancellationPolicy: input.cancellationPolicy ?? quote.cancellationPolicy,
        customerNotes: input.publicNotes ?? quote.customerNotes,
        internalNotes: input.internalNotes ?? quote.internalNotes
      };
    });
    return fallback(updated);
  }

  const { error } = await supabase.from("quotes").update({ ...toQuoteRow(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  return getQuoteById(id);
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const current = allDemoQuotes().find((quote) => quote.id === id);
    const updated = updateDemoQuote(id, (quote) => ({ ...quote, status }));
    if (updated && current?.status !== status) {
      await createQuoteStatusEvent({
        quoteId: id,
        fromStatus: current?.status,
        toStatus: status,
        note: "Cambio stato manuale backoffice"
      });
    }
    return fallback(updated);
  }

  const previous = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  const dbStatus = status === "perso_non_disponibile" ? "perso_non_disponibile" : status;
  const { error } = await supabase.from("quotes").update({ status: dbStatus, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  if (previous.data?.status !== dbStatus) {
    await createQuoteStatusEvent({
      quoteId: id,
      fromStatus: previous.data?.status,
      toStatus: dbStatus,
      note: "Cambio stato manuale backoffice"
    });
  }
  return getQuoteById(id);
}

export async function markQuoteConfirmed(id: string): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const current = allDemoQuotes().find((quote) => quote.id === id);
    markDemoQuoteConfirmed(id);
    if (current?.status !== "confermato") {
      await createQuoteStatusEvent({
        quoteId: id,
        fromStatus: current?.status,
        toStatus: "confermato",
        note: "Preventivo confermato dal cliente"
      });
    }
    return getQuoteById(id);
  }

  const previous = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  const { error } = await supabase.from("quotes").update({ status: "confermato", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  if (previous.data?.status !== "confermato") {
    await createQuoteStatusEvent({
      quoteId: id,
      fromStatus: previous.data?.status,
      toStatus: "confermato",
      note: "Preventivo confermato dal cliente"
    });
  }
  return getQuoteById(id);
}

export async function duplicateQuote(id: string): Promise<RepositoryResult<Quote | null>> {
  const source = await getQuoteById(id);
  if (!source.data) return fallback(null, source.error ?? "Preventivo non trovato");
  const quote = source.data;

  return createQuoteFromRequest({
    quoteRequestId: quote.requestId || undefined,
    clientFirstName: quote.customerFirstName,
    clientLastName: quote.customerLastName,
    clientEmail: quote.customerEmail,
    clientPhone: quote.customerPhone,
    hotelRequested: quote.requestedHotel,
    hotelId: quote.proposedHotel.id,
    alternativeHotelId: quote.alternativeHotel?.id,
    isAlternativeOffer: quote.isAlternative,
    checkIn: quote.arrivalDate,
    checkOut: quote.departureDate,
    adults: quote.adults,
    children: quote.children.map((child) => ({ birthDate: child.birthDate })),
    rooms: quote.rooms,
    treatment: quote.treatment,
    totalPrice: quote.totalPrice,
    depositAmount: quote.deposit,
    validUntil: quote.offerExpiresAt,
    includedServices: quote.servicesIncluded,
    transportOffers: quote.transportOffers ?? [],
    paymentPolicy: quote.paymentPolicy,
    cancellationPolicy: quote.cancellationPolicy,
    publicNotes: quote.customerNotes,
    internalNotes: `Duplicato da ${quote.code}. ${quote.internalNotes}`.trim()
  });
}

export async function excludeQuoteFromStats(id: string, excluded: boolean): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(excludeDemoQuoteFromStats(id, excluded));

  const { error } = await supabase.from("quotes").update({ excluded_from_stats: excluded, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  return getQuoteById(id);
}

export async function softDeleteQuote(id: string, reason?: string): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  if (!supabase) return fallback(softDeleteDemoQuote(id, reason));

  const { error } = await supabase.from("quotes").update({
    deleted_at: now,
    deleted_reason: reason ?? null,
    excluded_from_stats: true,
    updated_at: now
  }).eq("id", id);
  if (error) return fallback(null, error);
  return getQuoteById(id);
}

export async function restoreQuote(id: string): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(restoreDemoQuote(id));

  const { error } = await supabase.from("quotes").update({
    deleted_at: null,
    deleted_reason: null,
    excluded_from_stats: false,
    updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) return fallback(null, error);
  return getQuoteById(id);
}

function toQuoteRow(input: Partial<QuoteInput>) {
  return {
    ...(isUuid(input.quoteRequestId) ? { quote_request_id: input.quoteRequestId } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.publicToken !== undefined ? { public_token: input.publicToken } : {}),
    ...(input.clientFirstName !== undefined ? { client_first_name: input.clientFirstName } : {}),
    ...(input.clientLastName !== undefined ? { client_last_name: input.clientLastName } : {}),
    ...(input.clientEmail !== undefined ? { client_email: input.clientEmail } : {}),
    ...(input.clientPhone !== undefined ? { client_phone: input.clientPhone } : {}),
    ...(input.hotelRequested !== undefined ? { hotel_requested: input.hotelRequested } : {}),
    ...(isUuid(input.hotelId) ? { hotel_id: input.hotelId } : {}),
    ...(isUuid(input.alternativeHotelId) ? { alternative_hotel_id: input.alternativeHotelId } : {}),
    ...(input.isAlternativeOffer !== undefined ? { is_alternative_offer: input.isAlternativeOffer } : {}),
    ...(input.checkIn !== undefined ? { check_in: input.checkIn } : {}),
    ...(input.checkOut !== undefined ? { check_out: input.checkOut } : {}),
    ...(input.adults !== undefined ? { adults: input.adults } : {}),
    ...(input.children !== undefined ? { children_count: input.children.length } : {}),
    ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
    ...(input.treatment !== undefined ? { treatment: input.treatment } : {}),
    ...(input.totalPrice !== undefined ? { total_price: input.totalPrice } : {}),
    ...(input.depositAmount !== undefined ? { deposit_amount: input.depositAmount } : {}),
    ...(input.validUntil !== undefined ? { valid_until: input.validUntil } : {}),
    ...(input.includedServices !== undefined ? { included_services: input.includedServices } : {}),
    ...(input.transportOffers !== undefined ? { transport_offers: input.transportOffers } : {}),
    ...(input.paymentPolicy !== undefined ? { payment_policy: input.paymentPolicy } : {}),
    ...(input.cancellationPolicy !== undefined ? { cancellation_policy: input.cancellationPolicy } : {}),
    ...(input.publicNotes !== undefined ? { public_notes: input.publicNotes } : {}),
    ...(input.internalNotes !== undefined ? { internal_notes: input.internalNotes } : {})
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function withDemoStatus(quote: Quote): Quote {
  if (!isQuoteConfirmedInDemo(quote.id)) return quote;
  return { ...quote, status: "confermato", confirmation: quote.confirmation ?? { confirmedAt: new Date().toISOString(), fiscalCode: "", address: "", city: "", zip: "", province: "" } };
}
