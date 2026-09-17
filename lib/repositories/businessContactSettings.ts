import { revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache";
import {
  BUSINESS_CONTACT_SETTINGS_KEY,
  BusinessContactSettings,
  businessContactSettingsToDbValue,
  defaultBusinessContactSettings,
  normalizeBusinessContactSettings
} from "@/lib/business-contact-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUSINESS_CONTACT_SETTINGS_CACHE_TAG = "ischiastars-business-contact-settings";

export async function getBusinessContactSettings(): Promise<RepositoryResult<BusinessContactSettings>> {
  return getCachedBusinessContactSettings();
}

const getCachedBusinessContactSettings = unstable_cache(
  async (): Promise<RepositoryResult<BusinessContactSettings>> => getBusinessContactSettingsUncached(),
  [BUSINESS_CONTACT_SETTINGS_CACHE_TAG],
  { revalidate: 60, tags: [BUSINESS_CONTACT_SETTINGS_CACHE_TAG] }
);

async function getBusinessContactSettingsUncached(): Promise<RepositoryResult<BusinessContactSettings>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(defaultBusinessContactSettings);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", BUSINESS_CONTACT_SETTINGS_KEY)
    .maybeSingle();

  if (error) return fallback(defaultBusinessContactSettings, error);
  return fromSupabase(normalizeBusinessContactSettings(data?.value));
}

export async function updateBusinessContactSettings(settings: BusinessContactSettings): Promise<RepositoryResult<BusinessContactSettings>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeBusinessContactSettings({ ...settings, updatedAt: new Date().toISOString() });
  if (!supabase) return fallback(normalized);

  const { data, error } = await supabase
    .from("settings")
    .upsert({
      key: BUSINESS_CONTACT_SETTINGS_KEY,
      value: businessContactSettingsToDbValue(normalized)
    }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(normalized, error);
  revalidateTag(BUSINESS_CONTACT_SETTINGS_CACHE_TAG);
  return fromSupabase(normalizeBusinessContactSettings(data?.value));
}
