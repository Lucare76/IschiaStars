import { emptyFeatureFlags, FEATURE_FLAGS_KEY, FeatureFlagKey, FeatureFlags, normalizeFeatureFlags } from "@/lib/feature-flags";
import { emptyPaymentSettings, normalizePaymentSettings, PAYMENT_SETTINGS_KEY, PaymentSettings, paymentSettingsToDbValue } from "@/lib/payment-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getPaymentSettings(): Promise<RepositoryResult<PaymentSettings>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(emptyPaymentSettings);

  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", PAYMENT_SETTINGS_KEY)
    .maybeSingle();

  if (error) return fallback(emptyPaymentSettings, error);
  return fromSupabase(normalizePaymentSettings(data?.value));
}

export async function updatePaymentSettings(settings: PaymentSettings): Promise<RepositoryResult<PaymentSettings>> {
  const supabase = createSupabaseAdminClient();
  const normalized = normalizePaymentSettings({ ...settings, updatedAt: new Date().toISOString() });
  if (!supabase) return fallback(normalized);

  const { data, error } = await supabase
    .from("settings")
    .upsert({
      key: PAYMENT_SETTINGS_KEY,
      value: paymentSettingsToDbValue(normalized),
      updated_at: normalized.updatedAt
    }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(normalized, error);
  return fromSupabase(normalizePaymentSettings(data?.value));
}

export async function getFeatureFlags(): Promise<RepositoryResult<FeatureFlags>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(emptyFeatureFlags);

  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  if (error) return fallback(emptyFeatureFlags, error);
  return fromSupabase(normalizeFeatureFlags(data?.value));
}

export async function updateFeatureFlag(flag: FeatureFlagKey, value: boolean): Promise<RepositoryResult<FeatureFlags>> {
  const supabase = createSupabaseAdminClient();
  const current = await getFeatureFlags();
  const merged = normalizeFeatureFlags({ ...current.data, [flag]: value });
  if (!supabase) return fallback(merged);

  const { data, error } = await supabase
    .from("settings")
    .upsert({
      key: FEATURE_FLAGS_KEY,
      value: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(merged, error);
  return fromSupabase(normalizeFeatureFlags(data?.value));
}
