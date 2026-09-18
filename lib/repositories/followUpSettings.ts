import { revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache";
import {
  defaultFollowUpSettings,
  FOLLOW_UP_HISTORY_LIMIT,
  FOLLOW_UP_SETTINGS_HISTORY_KEY,
  FOLLOW_UP_SETTINGS_KEY,
  FollowUpSettings,
  FollowUpSettingsHistoryEntry,
  followUpSettingsToDbValue,
  normalizeFollowUpSettings,
  normalizeFollowUpSettingsHistory
} from "@/lib/follow-up-settings";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FOLLOW_UP_SETTINGS_CACHE_TAG = "ischiastars-follow-up-settings";

export async function getFollowUpSettings(): Promise<RepositoryResult<FollowUpSettings>> {
  return getCachedFollowUpSettings();
}

export async function getFollowUpSettingsFresh(): Promise<RepositoryResult<FollowUpSettings>> {
  noStore();
  return getFollowUpSettingsUncached();
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

export async function getFollowUpSettingsHistory(): Promise<RepositoryResult<FollowUpSettingsHistoryEntry[]>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback([]);

  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .eq("key", FOLLOW_UP_SETTINGS_HISTORY_KEY)
    .maybeSingle();

  if (error) return fallback([], error);
  return fromSupabase(normalizeFollowUpSettingsHistory(data?.value));
}

async function saveCurrentVersionToHistory(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const [{ data: currentRow, error: currentError }, { data: historyRow, error: historyError }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", FOLLOW_UP_SETTINGS_KEY).maybeSingle(),
    supabase.from("settings").select("value").eq("key", FOLLOW_UP_SETTINGS_HISTORY_KEY).maybeSingle()
  ]);

  if (currentError) return currentError;
  if (historyError) return historyError;
  if (!currentRow?.value) return null;

  const currentSettings = normalizeFollowUpSettings(currentRow.value);
  const history = normalizeFollowUpSettingsHistory(historyRow?.value);
  const savedAt = currentSettings.updatedAt || new Date().toISOString();
  const entry: FollowUpSettingsHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt,
    settings: currentSettings
  };

  const nextHistory = [entry, ...history].slice(0, FOLLOW_UP_HISTORY_LIMIT);
  const { error } = await supabase
    .from("settings")
    .upsert({ key: FOLLOW_UP_SETTINGS_HISTORY_KEY, value: nextHistory }, { onConflict: "key" });

  return error ?? null;
}

export async function updateFollowUpSettings(settings: FollowUpSettings): Promise<RepositoryResult<FollowUpSettings>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeFollowUpSettings({ ...settings, updatedAt: new Date().toISOString() });
  if (!supabase) return fallback(normalized);

  const historyError = await saveCurrentVersionToHistory(supabase);
  if (historyError) return fallback(normalized, historyError);

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

export async function restoreFollowUpSettingsVersion(id: string): Promise<RepositoryResult<FollowUpSettings | null>> {
  noStore();
  const historyResult = await getFollowUpSettingsHistory();
  const entry = historyResult.data.find((item) => item.id === id);
  if (!entry) return fromSupabase(null);
  return updateFollowUpSettings(entry.settings);
}
