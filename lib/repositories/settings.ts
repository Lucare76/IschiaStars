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
      value: paymentSettingsToDbValue(normalized)
    }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(normalized, error);
  return fromSupabase(normalizePaymentSettings(data?.value));
}

export async function getFeatureFlags(): Promise<RepositoryResult<FeatureFlags>> {
  // Fallback: variabile d'ambiente FEATURE_FLAGS_JSON (es. su Vercel)
  const envJson = process.env.FEATURE_FLAGS_JSON;
  if (envJson) {
    try {
      return fromSupabase(normalizeFeatureFlags(JSON.parse(envJson)));
    } catch {
      console.warn("[getFeatureFlags] FEATURE_FLAGS_JSON non è JSON valido, ignorato");
    }
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(emptyFeatureFlags);

  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  if (error) {
    console.error("[getFeatureFlags] Supabase error:", error.message);
    return fallback(emptyFeatureFlags, error);
  }
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
      value: merged
    }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(merged, error);
  return fromSupabase(normalizeFeatureFlags(data?.value));
}
