import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fillMissingHotelPolicies } from "@/lib/hotel-policies";
import { QuoteHotelOption, TreatmentOption } from "@/lib/types";

export type QuoteHotelOptionInput = {
  hotelId?: string;
  hotelGroup?: number;
  position: number;
  badge?: string | null;
  hotelReason?: string | null;
  roomTypeLabel?: string;
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
  breakfastDetails?: string | null;
  halfBoardDetails?: string | null;
  fullBoardDetails?: string | null;
  includedServices?: string;
  depositPercent?: number;
  balanceMethod?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
  paymentNotes?: string;
  notes?: string;
  commitmentNote?: string | null;
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
    hotelGroup: row.hotel_group != null ? Number(row.hotel_group) : 1,
    position: Number(row.position),
    badge: row.badge ? String(row.badge) : null,
    hotelReason: row.hotel_reason ? String(row.hotel_reason) : null,
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
    breakfastDetails: row.breakfast_details ? String(row.breakfast_details) : null,
    halfBoardDetails: row.half_board_details ? String(row.half_board_details) : null,
    fullBoardDetails: row.full_board_details ? String(row.full_board_details) : null,
    includedServices: row.included_services ? String(row.included_services) : undefined,
    depositPercent: row.deposit_percent != null ? Number(row.deposit_percent) : undefined,
    balanceMethod: row.balance_method ? String(row.balance_method) : undefined,
    paymentPolicy: row.payment_policy ? String(row.payment_policy) : undefined,
    cancellationPolicy: row.cancellation_policy ? String(row.cancellation_policy) : undefined,
    paymentNotes: row.payment_notes ? String(row.payment_notes) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    commitmentNote: row.commitment_note ? String(row.commitment_note) : null,
    isSelected: Boolean(row.is_selected),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    treatments
  };
}

export async function upsertHotelOptions(quoteId: string, options: QuoteHotelOptionInput[]): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { error } = await supabase.rpc("replace_hotel_options", {
    p_quote_id: quoteId,
    p_new_options: buildHotelOptionRows(options)
  });
  if (error) {
    console.error("[quote-hotel-options] replace_hotel_options RPC failed", error);
    throw new Error(error.message);
  }
}

export function buildHotelOptionRows(options: QuoteHotelOptionInput[]) {
  return options.slice(0, 9).map((opt, index) => {
    const policies = fillMissingHotelPolicies({
      hotelName: opt.hotelName,
      depositPercent: opt.depositPercent,
      balanceMethod: opt.balanceMethod,
      paymentPolicy: opt.paymentPolicy,
      cancellationPolicy: opt.cancellationPolicy,
      paymentNotes: opt.paymentNotes
    });
    return {
      hotel_id: isUuid(opt.hotelId) ? opt.hotelId : null,
      hotel_group: opt.hotelGroup ?? index + 1,
      position: opt.position ?? index + 1,
      badge: opt.badge || null,
      hotel_reason: opt.hotelReason || null,
      room_type_label: opt.roomTypeLabel ?? null,
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
      breakfast_details: opt.breakfastDetails || null,
      half_board_details: opt.halfBoardDetails || null,
      full_board_details: opt.fullBoardDetails || null,
      included_services: opt.includedServices ?? null,
      deposit_percent: policies.depositPercent ?? null,
      balance_method: policies.balanceMethod || null,
      payment_policy: policies.paymentPolicy || null,
      cancellation_policy: policies.cancellationPolicy || null,
      payment_notes: policies.paymentNotes || null,
      notes: opt.notes ?? null,
      commitment_note: opt.commitmentNote || null,
      is_selected: false
    };
  });
}

export async function fetchHotelOptionsForQuotes(quoteIds: string[]): Promise<Record<string, QuoteHotelOption[]>> {
  if (!quoteIds.length) return {};
  const supabase = createSupabaseAdminClient();
  if (!supabase) return {};

  const rows: Record<string, unknown>[] = [];
  for (const chunk of chunkArray(quoteIds, 100)) {
    const { data, error } = await supabase
      .from("quote_hotel_options")
      .select("*")
      .in("quote_id", chunk)
      .order("position");
    if (error) {
      console.warn("[quote-hotel-options] unable to load hotel options", error);
      continue;
    }
    rows.push(...(data as Record<string, unknown>[] ?? []));
  }

  const result: Record<string, QuoteHotelOption[]> = {};
  for (const row of rows) {
    const qid = String(row.quote_id);
    if (!result[qid]) result[qid] = [];
    result[qid].push(mapHotelOptionRow(row));
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
