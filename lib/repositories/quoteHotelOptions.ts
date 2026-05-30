import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { QuoteHotelOption, TreatmentOption } from "@/lib/types";

export type QuoteHotelOptionInput = {
  hotelId?: string;
  position: number;
  hotelName: string;
  hotelLocation?: string;
  hotelStars?: number;
  hotelImageUrl?: string;
  sourceUrl?: string;
  breakfastPrice?: number;
  halfBoardPrice?: number;
  fullBoardPrice?: number;
  breakfastLabel?: string;
  halfBoardLabel?: string;
  fullBoardLabel?: string;
  includedServices?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
  notes?: string;
};

export function mapHotelOptionRow(row: Record<string, unknown>): QuoteHotelOption {
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
    position: Number(row.position),
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
    paymentPolicy: row.payment_policy ? String(row.payment_policy) : undefined,
    cancellationPolicy: row.cancellation_policy ? String(row.cancellation_policy) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    isSelected: Boolean(row.is_selected),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    treatments
  };
}

export async function upsertHotelOptions(quoteId: string, options: QuoteHotelOptionInput[]): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase || options.length === 0) return;

  await supabase.from("quote_hotel_options").delete().eq("quote_id", quoteId);

  const rows = options.slice(0, 3).map((opt, index) => ({
    quote_id: quoteId,
    hotel_id: isUuid(opt.hotelId) ? opt.hotelId : null,
    position: opt.position ?? index + 1,
    hotel_name: opt.hotelName,
    hotel_location: opt.hotelLocation ?? null,
    hotel_stars: opt.hotelStars ?? null,
    hotel_image_url: opt.hotelImageUrl ?? null,
    source_url: opt.sourceUrl ?? null,
    breakfast_price: typeof opt.breakfastPrice === "number" ? opt.breakfastPrice : null,
    half_board_price: typeof opt.halfBoardPrice === "number" ? opt.halfBoardPrice : null,
    full_board_price: typeof opt.fullBoardPrice === "number" ? opt.fullBoardPrice : null,
    breakfast_label: opt.breakfastLabel ?? "Camera e colazione",
    half_board_label: opt.halfBoardLabel ?? "Mezza pensione",
    full_board_label: opt.fullBoardLabel ?? "Pensione completa",
    included_services: opt.includedServices ?? null,
    payment_policy: opt.paymentPolicy ?? null,
    cancellation_policy: opt.cancellationPolicy ?? null,
    notes: opt.notes ?? null,
    is_selected: false
  }));

  await supabase.from("quote_hotel_options").insert(rows);
}

export async function fetchHotelOptionsForQuotes(quoteIds: string[]): Promise<Record<string, QuoteHotelOption[]>> {
  if (!quoteIds.length) return {};
  const supabase = createSupabaseAdminClient();
  if (!supabase) return {};

  const { data } = await supabase
    .from("quote_hotel_options")
    .select("*")
    .in("quote_id", quoteIds)
    .order("position");

  const result: Record<string, QuoteHotelOption[]> = {};
  for (const row of data ?? []) {
    const qid = String(row.quote_id);
    if (!result[qid]) result[qid] = [];
    result[qid].push(mapHotelOptionRow(row as Record<string, unknown>));
  }
  return result;
}

export async function markHotelOptionSelected(optionId: string, quoteId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  await supabase
    .from("quote_hotel_options")
    .update({ is_selected: false, updated_at: now })
    .eq("quote_id", quoteId);

  await supabase
    .from("quote_hotel_options")
    .update({ is_selected: true, updated_at: now })
    .eq("id", optionId);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
