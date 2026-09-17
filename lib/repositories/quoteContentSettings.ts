import { revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache";
import {
  defaultQuoteContentSettings,
  normalizeQuoteContentSettings,
  QUOTE_CONTENT_SETTINGS_KEY,
  QuoteContentSettings
} from "@/lib/quote-content-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const QUOTE_CONTENT_SETTINGS_CACHE_TAG = "ischiastars-quote-content-settings";

export async function getQuoteContentSettings(): Promise<RepositoryResult<QuoteContentSettings>> {
  return getCachedQuoteContentSettings();
}

const getCachedQuoteContentSettings = unstable_cache(
  async (): Promise<RepositoryResult<QuoteContentSettings>> => getQuoteContentSettingsUncached(),
  [QUOTE_CONTENT_SETTINGS_CACHE_TAG],
  { revalidate: 60, tags: [QUOTE_CONTENT_SETTINGS_CACHE_TAG] }
);

async function getQuoteContentSettingsUncached(): Promise<RepositoryResult<QuoteContentSettings>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(defaultQuoteContentSettings);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", QUOTE_CONTENT_SETTINGS_KEY)
    .maybeSingle();

  if (error) return fallback(defaultQuoteContentSettings, error);
  return fromSupabase(normalizeQuoteContentSettings(data?.value));
}

export async function updateQuoteContentSettings(settings: QuoteContentSettings): Promise<RepositoryResult<QuoteContentSettings>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeQuoteContentSettings({ ...settings, updatedAt: new Date().toISOString() });
  if (!supabase) return fallback(normalized);

  const { data, error } = await supabase
    .from("settings")
    .upsert({ key: QUOTE_CONTENT_SETTINGS_KEY, value: normalized }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(normalized, error);
  revalidateTag(QUOTE_CONTENT_SETTINGS_CACHE_TAG);
  return fromSupabase(normalizeQuoteContentSettings(data?.value));
}
