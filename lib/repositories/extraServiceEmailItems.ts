import { unstable_noStore as noStore } from "next/cache";
import { ExtraServiceEmailItem, ExtraServiceEmailItemInput, mapExtraServiceEmailItem } from "@/lib/extra-service-email-items";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function listExtraServiceEmailItems(activeOnly = false): Promise<RepositoryResult<ExtraServiceEmailItem[]>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback([]);

  let query = supabase
    .from("extra_service_email_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return fallback([], error);
  return fromSupabase((data ?? []).map(mapExtraServiceEmailItem));
}

export async function saveExtraServiceEmailItems(items: ExtraServiceEmailItemInput[]): Promise<RepositoryResult<ExtraServiceEmailItem[]>> {
  noStore();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(items);

  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    id: item.id,
    title: item.title.trim(),
    description: item.description.trim() || null,
    price_from: item.priceFrom,
    price_suffix: item.priceSuffix.trim() || "a persona",
    is_active: item.isActive,
    sort_order: item.sortOrder,
    updated_at: now
  }));

  const { error } = await supabase
    .from("extra_service_email_items")
    .upsert(rows, { onConflict: "id" });

  if (error) return fallback(items, error);
  return listExtraServiceEmailItems();
}
