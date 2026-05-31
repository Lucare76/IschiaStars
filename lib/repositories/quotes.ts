import { hotels } from "@/lib/mock-data";
import { addDemoQuote, allDemoQuotes, excludeDemoQuoteFromStats, isQuoteConfirmedInDemo, markQuoteConfirmed as markDemoQuoteConfirmed, restoreDemoQuote, softDeleteDemoQuote, updateDemoQuote } from "@/lib/demo-store";
import { listHotels } from "@/lib/repositories/hotels";
import { QuoteHotelOptionInput, fetchHotelOptionsForQuotes, upsertHotelOptions } from "@/lib/repositories/quoteHotelOptions";
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
  hotelOptions?: QuoteHotelOptionInput[];
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

  const quoteIds = (data ?? []).map((row) => row.id as string);
  const [childRowsResult, hotelOptionsMap, confirmationsMap] = await Promise.all([
    quoteIds.length ? supabase.from("quote_children").select("*").in("quote_id", quoteIds) : Promise.resolve({ data: [] }),
    fetchHotelOptionsForQuotes(quoteIds),
    fetchConfirmationsForQuotes(quoteIds)
  ]);

  const allHotels = hotelResult.data.length ? hotelResult.data : hotels;
  const childRows = childRowsResult.data ?? [];

  return fromSupabase(
    (data ?? []).map((row) => {
      const hotelOpts = hotelOptionsMap[row.id as string] ?? [];
      return withDemoStatus(mapQuote(row as Record<string, unknown>, allHotels, childRows as Record<string, unknown>[], hotelOpts, confirmationsMap[row.id as string]));
    })
  );
}

export async function getQuoteByCodeAndToken(code: string, token?: string): Promise<RepositoryResult<Quote | null>> {
  const local = allDemoQuotes().find((q) => q.code === code && q.token === token) ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase || !token) return fallback(local);

  const { data, error } = await supabase.from("quotes").select("*").eq("code", code).eq("public_token", token).maybeSingle();
  if (error || !data) return error ? fallback(local, error) : fromSupabase(null);

  const hotelResult = await listHotels();
  const quoteId = (data as Record<string, unknown>).id as string;
  const [childRowsResult, hotelOptionsMap, confirmationsMap] = await Promise.all([
    supabase.from("quote_children").select("*").eq("quote_id", quoteId),
    fetchHotelOptionsForQuotes([quoteId]),
    fetchConfirmationsForQuotes([quoteId])
  ]);

  const hotelOpts = hotelOptionsMap[quoteId] ?? [];
  const allHotels = hotelResult.data.length ? hotelResult.data : hotels;
  return fromSupabase(withDemoStatus(mapQuote(data as Record<string, unknown>, allHotels, childRowsResult.data as Record<string, unknown>[] ?? [], hotelOpts, confirmationsMap[quoteId])));
}

export async function getQuoteById(id: string): Promise<RepositoryResult<Quote | null>> {
  const local = allDemoQuotes().find((q) => q.id === id) ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (error) return fallback(local, error);
  if (!data) return fromSupabase(null);

  const hotelResult = await listHotels();
  const [childRowsResult, hotelOptionsMap, confirmationsMap] = await Promise.all([
    supabase.from("quote_children").select("*").eq("quote_id", id),
    fetchHotelOptionsForQuotes([id]),
    fetchConfirmationsForQuotes([id])
  ]);

  const hotelOpts = hotelOptionsMap[id] ?? [];
  const allHotels = hotelResult.data.length ? hotelResult.data : hotels;
  return fromSupabase(withDemoStatus(mapQuote(data as Record<string, unknown>, allHotels, childRowsResult.data as Record<string, unknown>[] ?? [], hotelOpts, confirmationsMap[id])));
}

async function fetchConfirmationsForQuotes(quoteIds: string[]): Promise<Record<string, Record<string, unknown>>> {
  if (!quoteIds.length) return {};
  const supabase = createSupabaseAdminClient();
  if (!supabase) return {};

  const { data } = await supabase
    .from("quote_confirmations")
    .select("quote_id,created_at,fiscal_code,address,city,postal_code,province,selected_hotel_option_id,selected_hotel_name,selected_treatment_key,selected_treatment_label,selected_price")
    .in("quote_id", quoteIds);

  const result: Record<string, Record<string, unknown>> = {};
  for (const row of data ?? []) {
    result[String(row.quote_id)] = row as Record<string, unknown>;
  }
  return result;
}

export async function createQuoteFromRequest(input: QuoteInput, options: { accessToken?: string } = {}): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAuthenticatedClient(options.accessToken) ?? createSupabaseAdminClient();
  const normalizedInput = {
    ...input,
    code: input.code ?? await nextQuoteCode(supabase ?? undefined),
    publicToken: input.publicToken ?? secureToken()
  };

  if (!supabase) {
    const hotelResult = await listHotels();
    const proposedHotel = hotelResult.data.find((h) => h.id === normalizedInput.hotelId) ?? hotelResult.data[0] ?? hotels[0];
    const alternativeHotel = hotelResult.data.find((h) => h.id === normalizedInput.alternativeHotelId);
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
      children: (normalizedInput.children ?? []).map((child, index) => ({
        id: `child-local-${Date.now()}-${index}`,
        firstName: `Bambino ${index + 1}`,
        birthDate: child.birthDate
      })),
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
      excludedFromStats: false,
      hotelOptions: []
    };
    addDemoQuote(quote);
    await createQuoteStatusEvent({ quoteId: quote.id, fromStatus: null, toStatus: quote.status, note: "Preventivo creato" });
    return fallback(quote);
  }

  const row = toQuoteRow(normalizedInput);
  const { data, error } = await supabase.from("quotes").insert(row).select("*").single();
  if (error) return fallback(null, error);

  await createQuoteStatusEvent({ quoteId: (data as Record<string, unknown>).id as string, fromStatus: null, toStatus: "preventivo_inviato", note: "Preventivo creato" });

  const quoteId = (data as Record<string, unknown>).id as string;

  if (normalizedInput.children?.length) {
    await supabase.from("quote_children").insert(normalizedInput.children.map((child) => ({ quote_id: quoteId, birth_date: child.birthDate })));
  }

  if (normalizedInput.hotelOptions?.length) {
    await upsertHotelOptions(quoteId, normalizedInput.hotelOptions);
  }

  return getQuoteById(quoteId);
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
  const max = allDemoQuotes().reduce((current, q) => {
    const match = q.code.match(/^IS-\d{4}-(\d+)$/);
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
      const proposedHotel = input.hotelId ? hotelResult.data.find((h) => h.id === input.hotelId) ?? quote.proposedHotel : quote.proposedHotel;
      const alternativeHotel = input.alternativeHotelId ? hotelResult.data.find((h) => h.id === input.alternativeHotelId) : quote.alternativeHotel;
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

  if (input.hotelOptions?.length) {
    await upsertHotelOptions(id, input.hotelOptions);
  }

  return getQuoteById(id);
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const current = allDemoQuotes().find((q) => q.id === id);
    const updated = updateDemoQuote(id, (q) => ({ ...q, status }));
    if (updated && current?.status !== status) {
      await createQuoteStatusEvent({ quoteId: id, fromStatus: current?.status, toStatus: status, note: "Cambio stato manuale backoffice" });
    }
    return fallback(updated);
  }

  const previous = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  const dbStatus = status;
  const { error } = await supabase.from("quotes").update({ status: dbStatus, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  if (previous.data?.status !== dbStatus) {
    await createQuoteStatusEvent({ quoteId: id, fromStatus: previous.data?.status as string | undefined, toStatus: dbStatus, note: "Cambio stato manuale backoffice" });
  }
  return getQuoteById(id);
}

export async function markQuoteConfirmed(id: string): Promise<RepositoryResult<Quote | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const current = allDemoQuotes().find((q) => q.id === id);
    markDemoQuoteConfirmed(id);
    if (current?.status !== "confermato") {
      await createQuoteStatusEvent({ quoteId: id, fromStatus: current?.status, toStatus: "confermato", note: "Preventivo confermato dal cliente" });
    }
    return getQuoteById(id);
  }

  const previous = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  const { error } = await supabase.from("quotes").update({ status: "confermato", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  if (previous.data?.status !== "confermato") {
    await createQuoteStatusEvent({ quoteId: id, fromStatus: previous.data?.status as string | undefined, toStatus: "confermato", note: "Preventivo confermato dal cliente" });
  }
  return getQuoteById(id);
}

export async function duplicateQuote(id: string): Promise<RepositoryResult<Quote | null>> {
  const source = await getQuoteById(id);
  if (!source.data) return fallback(null, source.error ?? "Preventivo non trovato");
  const quote = source.data;

  const hotelOptions: QuoteHotelOptionInput[] = quote.hotelOptions
    .filter((o) => !o.id.startsWith("virtual-"))
    .map((o) => ({
      hotelId: o.hotelId,
      position: o.position,
      hotelName: o.hotelName,
      hotelLocation: o.hotelLocation,
      hotelStars: o.hotelStars,
      hotelImageUrl: o.hotelImageUrl,
      sourceUrl: o.sourceUrl,
      breakfastPrice: o.breakfastPrice,
      halfBoardPrice: o.halfBoardPrice,
      fullBoardPrice: o.fullBoardPrice,
      breakfastLabel: o.breakfastLabel,
      halfBoardLabel: o.halfBoardLabel,
      fullBoardLabel: o.fullBoardLabel,
      includedServices: o.includedServices,
      paymentPolicy: o.paymentPolicy,
      cancellationPolicy: o.cancellationPolicy,
      notes: o.notes
    }));

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
    children: quote.children.map((c) => ({ birthDate: c.birthDate })),
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
    internalNotes: `Duplicato da ${quote.code}. ${quote.internalNotes}`.trim(),
    hotelOptions: hotelOptions.length > 0 ? hotelOptions : undefined
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
  return {
    ...quote,
    status: "confermato",
    confirmation: quote.confirmation ?? {
      confirmedAt: new Date().toISOString(),
      fiscalCode: "",
      address: "",
      city: "",
      zip: "",
      province: ""
    }
  };
}
