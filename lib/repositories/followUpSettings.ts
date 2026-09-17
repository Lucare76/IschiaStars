import { revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache";
import {
  defaultFollowUpSettings,
  FOLLOW_UP_SETTINGS_KEY,
  FollowUpSettings,
  followUpSettingsToDbValue,
  normalizeFollowUpSettings
} from "@/lib/follow-up-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FOLLOW_UP_SETTINGS_CACHE_TAG = "ischiastars-follow-up-settings";

export async function getFollowUpSettings(): Promise<RepositoryResult<FollowUpSettings>> {
  return getCachedFollowUpSettings();
}

const getCachedFollowUpSettings = unstable_cache(
  async (): Promise<RepositoryResult<FollowUpSettings>> => getFollowUpSettingsUncached(),
  [FOLLOW_UP_SETTINGS_CACHE_TAG],
  { revalidate: 60, tags: [FOLLOW_UP_SETTINGS_CACHE_TAG] }
);

async function getFollowUpSettingsUncached(): Promise<RepositoryResult<FollowUpSettings>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(defaultFollowUpSettings);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", FOLLOW_UP_SETTINGS_KEY)
    .maybeSingle();

  if (error) return fallback(defaultFollowUpSettings, error);
  return fromSupabase(normalizeFollowUpSettings(data?.value));
}

export async function updateFollowUpSettings(settings: FollowUpSettings): Promise<RepositoryResult<FollowUpSettings>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeFollowUpSettings({ ...settings, updatedAt: new Date().toISOString() });
  if (!supabase) return fallback(normalized);

  const { data, error } = await supabase
    .from("settings")
    .upsert({
      key: FOLLOW_UP_SETTINGS_KEY,
      value: followUpSettingsToDbValue(normalized)
    }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(normalized, error);
  revalidateTag(FOLLOW_UP_SETTINGS_CACHE_TAG);
  return fromSupabase(normalizeFollowUpSettings(data?.value));
}
