import { emptyFeatureFlags, FEATURE_FLAGS_KEY, FeatureFlagKey, FeatureFlags, normalizeFeatureFlags } from "@/lib/feature-flags";
import { emptyPaymentSettings, normalizePaymentSettings, PAYMENT_SETTINGS_KEY, PaymentSettings, paymentSettingsToDbValue } from "@/lib/payment-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getPaymentSettings(): Promise<RepositoryResult<PaymentSettings>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(emptyPaymentSettings);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
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
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(emptyFeatureFlags);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  if (error) {
    console.error("[getFeatureFlags] Supabase error:", error.message);
    // Fallback: variabile d'ambiente FEATURE_FLAGS_JSON (solo se DB non disponibile)
    const envJson = process.env.FEATURE_FLAGS_JSON;
    if (envJson) {
      try { return fallback(normalizeFeatureFlags(JSON.parse(envJson))); } catch {}
    }
    return fallback(emptyFeatureFlags, error);
  }
  return fromSupabase(normalizeFeatureFlags(data?.value));
}

export async function updateFeatureFlag(flag: FeatureFlagKey, value: boolean): Promise<RepositoryResult<FeatureFlags>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(emptyFeatureFlags);

  // Legge lo stato corrente direttamente dal DB (non da env var)
  const { data: currentRow, error: readError } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  console.log(`[updateFeatureFlag] READ: currentRow=${JSON.stringify(currentRow)} readError=${readError?.message ?? "null"}`);

  const currentValue = currentRow?.value;
  const currentParsed = currentValue && typeof currentValue === "object" ? currentValue as Record<string, unknown> : {};
  const merged = normalizeFeatureFlags({ ...currentParsed, [flag]: value });

  console.log(`[updateFeatureFlag] UPSERT: flag=${flag} value=${value} merged=${JSON.stringify(merged)}`);

  const { data, error } = await supabase
    .from("settings")
    .upsert({
      key: FEATURE_FLAGS_KEY,
      value: merged
    }, { onConflict: "key" })
    .select("value")
    .single();

  console.log(`[updateFeatureFlag] RESULT: data=${JSON.stringify(data)} error=${error?.message ?? "null"} source=${error ? "mock" : "supabase"}`);

  if (error) return fallback(merged, error);
  return fromSupabase(normalizeFeatureFlags(data?.value));
}
