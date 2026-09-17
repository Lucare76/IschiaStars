import { revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache";
import {
  defaultFollowUpRuleSettings,
  FOLLOW_UP_RULE_SETTINGS_KEY,
  FollowUpRuleSettings,
  normalizeFollowUpRuleSettings
} from "@/lib/follow-up-rule-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FOLLOW_UP_RULE_SETTINGS_CACHE_TAG = "ischiastars-follow-up-rule-settings";

export async function getFollowUpRuleSettings(): Promise<RepositoryResult<FollowUpRuleSettings>> {
  return getCachedFollowUpRuleSettings();
}

const getCachedFollowUpRuleSettings = unstable_cache(
  async (): Promise<RepositoryResult<FollowUpRuleSettings>> => getFollowUpRuleSettingsUncached(),
  [FOLLOW_UP_RULE_SETTINGS_CACHE_TAG],
  { revalidate: 60, tags: [FOLLOW_UP_RULE_SETTINGS_CACHE_TAG] }
);

async function getFollowUpRuleSettingsUncached(): Promise<RepositoryResult<FollowUpRuleSettings>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(defaultFollowUpRuleSettings);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", FOLLOW_UP_RULE_SETTINGS_KEY)
    .maybeSingle();

  if (error) return fallback(defaultFollowUpRuleSettings, error);
  return fromSupabase(normalizeFollowUpRuleSettings(data?.value));
}

export async function updateFollowUpRuleSettings(settings: FollowUpRuleSettings): Promise<RepositoryResult<FollowUpRuleSettings>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeFollowUpRuleSettings({ ...settings, updatedAt: new Date().toISOString() });
  if (!supabase) return fallback(normalized);

  const { data, error } = await supabase
    .from("settings")
    .upsert({ key: FOLLOW_UP_RULE_SETTINGS_KEY, value: normalized }, { onConflict: "key" })
    .select("value")
    .single();

  if (error) return fallback(normalized, error);
  revalidateTag(FOLLOW_UP_RULE_SETTINGS_CACHE_TAG);
  return fromSupabase(normalizeFollowUpRuleSettings(data?.value));
}
