import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { markQuoteConfirmed as markStoredQuoteConfirmed } from "@/lib/repositories/quotes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ConfirmationAvailabilityStatus } from "@/lib/types";

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
  selectedDepositPercent?: number;
  selectedDepositAmount?: number;
  selectedBalanceAmount?: number;
  selectedBalanceMethod?: string;
  selectedPaymentPolicy?: string;
  selectedCancellationPolicy?: string;
  paymentSettingsSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export async function createQuoteConfirmation(quoteId: string, input: QuoteConfirmationInput): Promise<RepositoryResult<{ confirmedAt: string } | null>> {
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    await markStoredQuoteConfirmed(quoteId);
    return fallback({ confirmedAt: now });
  }

  const metadata = {
    ...(input.metadata ?? {}),
    selectedHotelOptionId: input.selectedHotelOptionId,
    selectedHotelName: input.selectedHotelName,
    selectedTreatmentKey: input.selectedTreatmentKey,
    selectedTreatmentLabel: input.selectedTreatmentLabel,
    selectedPrice: input.selectedPrice,
    selectedDepositPercent: input.selectedDepositPercent,
    selectedDepositAmount: input.selectedDepositAmount,
    selectedBalanceAmount: input.selectedBalanceAmount,
    selectedBalanceMethod: input.selectedBalanceMethod,
    selectedPaymentPolicy: input.selectedPaymentPolicy,
    selectedCancellationPolicy: input.selectedCancellationPolicy,
    ...(input.paymentSettingsSnapshot ? { paymentSettingsSnapshot: input.paymentSettingsSnapshot } : {})
  };
  const { error } = await supabase.rpc("confirm_quote", {
    p_quote_id: quoteId,
    p_option_id: input.selectedHotelOptionId ?? null,
    p_treatment_key: input.selectedTreatmentKey ?? null,
    p_confirmation_data: {
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
      selected_deposit_percent: input.selectedDepositPercent ?? null,
      selected_deposit_amount: input.selectedDepositAmount ?? null,
      selected_balance_amount: input.selectedBalanceAmount ?? null,
      selected_balance_method: input.selectedBalanceMethod ?? null,
      selected_payment_policy: input.selectedPaymentPolicy ?? null,
      selected_cancellation_policy: input.selectedCancellationPolicy ?? null,
      payment_settings_snapshot: input.paymentSettingsSnapshot ?? null,
      metadata
    }
  });

  if (error) {
    console.error("[confirmation] confirm_quote RPC failed", error);
    const message = error.message.includes("already_confirmed")
      ? "Questo preventivo è già stato confermato"
      : "Operazione non riuscita. Riprova.";
    return fallback(null, message);
  }

  return fromSupabase({ confirmedAt: now });
}

export async function getQuoteConfirmation(quoteId: string): Promise<RepositoryResult<Record<string, unknown> | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(null);

  const { data, error } = await supabase.from("quote_confirmations").select("*").eq("quote_id", quoteId).maybeSingle();
  if (error) return fallback(null, error);
  return fromSupabase(data as Record<string, unknown> | null);
}

export async function getQuoteConfirmationById(id: string): Promise<RepositoryResult<Record<string, unknown> | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(null);

  const { data, error } = await supabase.from("quote_confirmations").select("*").eq("id", id).maybeSingle();
  if (error) return fallback(null, error);
  return fromSupabase(data as Record<string, unknown> | null);
}

export async function getConfirmedHotelCounts(): Promise<Record<string, number>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return {};

  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from("quote_confirmations")
    .select("quote_hotel_options!inner(hotel_name)")
    .not("selected_hotel_option_id", "is", null)
    .gte("created_at", `${year}-01-01T00:00:00.000Z`)
    .lt("created_at", `${year + 1}-01-01T00:00:00.000Z`);

  if (error) return {};

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const hotelName = (row.quote_hotel_options as unknown as { hotel_name: string } | null)?.hotel_name;
    if (typeof hotelName === "string" && hotelName) {
      counts[hotelName] = (counts[hotelName] ?? 0) + 1;
    }
  }
  return counts;
}

export async function updateQuoteConfirmationAvailability(
  id: string,
  input: {
    status: ConfirmationAvailabilityStatus;
    depositDueAt?: string | null;
    finalConfirmationSentAt?: string | null;
    finalConfirmationNotes?: string | null;
    unavailableReason?: string | null;
    unavailabilityEmailSentAt?: string | null;
    paymentSettingsSnapshot?: Record<string, unknown> | null;
  }
): Promise<RepositoryResult<Record<string, unknown> | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(null);

  const now = new Date().toISOString();
  const update = {
    availability_status: input.status,
    availability_updated_at: now,
    ...(input.depositDueAt !== undefined ? { deposit_due_at: input.depositDueAt } : {}),
    ...(input.finalConfirmationSentAt !== undefined ? { final_confirmation_sent_at: input.finalConfirmationSentAt } : {}),
    ...(input.finalConfirmationNotes !== undefined ? { final_confirmation_notes: input.finalConfirmationNotes } : {}),
    ...(input.unavailableReason !== undefined ? { unavailable_reason: input.unavailableReason } : {}),
    ...(input.unavailabilityEmailSentAt !== undefined ? { unavailability_email_sent_at: input.unavailabilityEmailSentAt } : {}),
    ...(input.paymentSettingsSnapshot !== undefined ? { payment_settings_snapshot: input.paymentSettingsSnapshot } : {})
  };

  const { data, error } = await supabase
    .from("quote_confirmations")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return fallback(null, error);
  return fromSupabase(data as Record<string, unknown>);
}

export async function markDepositPaid(id: string): Promise<RepositoryResult<Record<string, unknown> | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(null);

  const { data, error } = await supabase
    .from("quote_confirmations")
    .update({ deposit_paid_at: new Date().toISOString() })
    .eq("id", id)
    .is("deposit_paid_at", null)
    .select("*")
    .maybeSingle();

  if (error) return fallback(null, error);
  if (data) return fromSupabase(data as Record<string, unknown>);

  return getQuoteConfirmationById(id);
}
