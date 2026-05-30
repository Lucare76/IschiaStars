import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { markHotelOptionSelected } from "@/lib/repositories/quoteHotelOptions";
import { markQuoteConfirmed as markStoredQuoteConfirmed } from "@/lib/repositories/quotes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type QuoteConfirmationInput = {
  firstName: string;
  lastName: string;
  fiscalCode: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  province: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  selectedHotelOptionId?: string;
  selectedHotelName?: string;
  selectedTreatmentKey?: string;
  selectedTreatmentLabel?: string;
  selectedPrice?: number;
  metadata?: Record<string, unknown>;
};

export async function createQuoteConfirmation(quoteId: string, input: QuoteConfirmationInput): Promise<RepositoryResult<{ confirmedAt: string } | null>> {
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    await markStoredQuoteConfirmed(quoteId);
    return fallback({ confirmedAt: now });
  }

  const { error } = await supabase.from("quote_confirmations").upsert({
    quote_id: quoteId,
    first_name: input.firstName,
    last_name: input.lastName,
    fiscal_code: input.fiscalCode,
    phone: input.phone,
    email: input.email,
    address: input.address,
    city: input.city,
    postal_code: input.postalCode,
    province: input.province,
    accepted_terms: input.acceptedTerms,
    accepted_privacy: input.acceptedPrivacy,
    selected_hotel_option_id: input.selectedHotelOptionId ?? null,
    selected_hotel_name: input.selectedHotelName ?? null,
    selected_treatment_key: input.selectedTreatmentKey ?? null,
    selected_treatment_label: input.selectedTreatmentLabel ?? null,
    selected_price: input.selectedPrice ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      selectedHotelOptionId: input.selectedHotelOptionId,
      selectedHotelName: input.selectedHotelName,
      selectedTreatmentKey: input.selectedTreatmentKey,
      selectedTreatmentLabel: input.selectedTreatmentLabel,
      selectedPrice: input.selectedPrice
    }
  });

  if (error) return fallback(null, error);

  await markStoredQuoteConfirmed(quoteId);
  console.info(`[confirmation] status updated quote=${quoteId}`);

  if (input.selectedHotelOptionId) {
    await markHotelOptionSelected(input.selectedHotelOptionId, quoteId);
  }

  await trackQuoteEvent(quoteId, "quote_confirmed", {
    source: "quote_confirmation",
    selectedHotelOptionId: input.selectedHotelOptionId,
    selectedHotelName: input.selectedHotelName,
    selectedTreatmentKey: input.selectedTreatmentKey,
    selectedTreatmentLabel: input.selectedTreatmentLabel,
    selectedPrice: input.selectedPrice
  });
  console.info(`[confirmation] event saved quote=${quoteId}`);

  return fromSupabase({ confirmedAt: now });
}

export async function getQuoteConfirmation(quoteId: string): Promise<RepositoryResult<Record<string, unknown> | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(null);

  const { data, error } = await supabase.from("quote_confirmations").select("*").eq("quote_id", quoteId).maybeSingle();
  if (error) return fallback(null, error);
  return fromSupabase(data as Record<string, unknown> | null);
}
