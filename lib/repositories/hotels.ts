import { allDemoHotels, deleteDemoHotel, upsertDemoHotel } from "@/lib/demo-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ImportedIschiaStarsHotel, mapImportedHotelToDbHotel, normalizeHotelName } from "@/lib/server/ischiastars-hotel-importer";
import { fetchLrHotelQuotesFeed, mapLrHotelToDbRow } from "@/lib/server/lr-hotel-feed";
import { fillMissingHotelPolicies } from "@/lib/hotel-policies";
import { Hotel } from "@/lib/types";
import { fallback, fromSupabase, mapHotel, RepositoryResult } from "@/lib/repositories/shared";

export type HotelInput = {
  name: string;
  location: string;
  stars: number;
  shortDescription?: string;
  imageUrl?: string;
  standardServices?: string[];
  defaultDepositPercent?: number;
  defaultBalanceMethod?: string;
  defaultPaymentNotes?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
  internalNotes?: string;
  isActive?: boolean;
  slug?: string;
};

export type HotelSyncReport = {
  imported: number;
  updated: number;
  alreadyPresent: number;
  notDetected: number;
  errors: string[];
  hotels: Hotel[];
};

export async function listHotels(): Promise<RepositoryResult<Hotel[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(allDemoHotels());

  const { data, error } = await supabase.from("hotels").select("*").order("name");
  if (error) return fallback(allDemoHotels(), error);
  return fromSupabase((data ?? []).map(mapHotel));
}

export async function syncImportedHotels(importedHotels: ImportedIschiaStarsHotel[]): Promise<RepositoryResult<HotelSyncReport>> {
  const emptyReport: HotelSyncReport = {
    imported: 0,
    updated: 0,
    alreadyPresent: 0,
    notDetected: 0,
    errors: [],
    hotels: []
  };
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { data: emptyReport, source: "mock", error: "La sincronizzazione richiede il collegamento al database operativo." };

  const { data: existingRows, error: existingError } = await supabase.from("hotels").select("*");
  if (existingError) return { data: emptyReport, source: "supabase", error: existingError.message };

  const existing = existingRows ?? [];
  const seenIds = new Set<string>();
  const importedResults: Hotel[] = [];
  const report: HotelSyncReport = { ...emptyReport, errors: [] };

  for (const importedHotel of importedHotels) {
    try {
      const match = findMatchingHotel(existing, importedHotel);
      const row = mapImportedHotelToDbHotel(importedHotel);
      const matchedRow = match?.row;

      if (!matchedRow) {
        const { data, error } = await supabase.from("hotels").insert(row).select("*").single();
        if (error) throw error;
        existing.push(data);
        seenIds.add(data.id);
        importedResults.push(mapHotel(data));
        report.imported += 1;
        continue;
      }

      seenIds.add(matchedRow.id);
      const updateRow = toImportedUpdateRow(matchedRow, row);
      const { data, error } = await supabase.from("hotels").update(updateRow).eq("id", matchedRow.id).select("*").single();
      if (error) throw error;

      const index = existing.findIndex((item) => item.id === data.id);
      if (index >= 0) existing[index] = data;
      importedResults.push(mapHotel(data));
      if (hasMeaningfulImportChanges(matchedRow, updateRow)) report.updated += 1;
      else report.alreadyPresent += 1;
    } catch (error) {
      report.errors.push(`${importedHotel.name}: ${error instanceof Error ? error.message : "Errore importazione"}`);
    }
  }

  report.notDetected = existing.filter((row) => isWordPressHotelRow(row) && !seenIds.has(row.id)).length;
  report.hotels = importedResults;
  return fromSupabase(report);
}

export async function getActiveHotels() {
  const result = await listHotels();
  return { ...result, data: result.data.filter((hotel) => hotel.active) };
}

export async function getHotelById(id: string): Promise<RepositoryResult<Hotel | null>> {
  const local = allDemoHotels().find((hotel) => hotel.id === id) ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const { data, error } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle();
  if (error) return fallback(local, error);
  return fromSupabase(data ? mapHotel(data) : null);
}

export async function createHotel(input: HotelInput): Promise<RepositoryResult<Hotel | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return fallback(
      upsertDemoHotel({
        id: `hotel-local-${Date.now()}`,
        name: input.name,
        zone: input.location,
        stars: input.stars,
        description: input.shortDescription ?? "",
        imageUrl: input.imageUrl,
        standardServices: input.standardServices ?? [],
        defaultDepositPercent: input.defaultDepositPercent,
        defaultBalanceMethod: input.defaultBalanceMethod,
        defaultPaymentNotes: input.defaultPaymentNotes,
        paymentPolicy: input.paymentPolicy ?? "",
        cancellationPolicy: input.cancellationPolicy ?? "",
        internalNotes: input.internalNotes ?? "",
        active: input.isActive ?? true
      })
    );
  }

  const { data, error } = await supabase
    .from("hotels")
    .insert(toHotelRow(input))
    .select("*")
    .single();

  if (error) return fallback(null, error);
  return fromSupabase(mapHotel(data));
}

export async function updateHotel(id: string, input: Partial<HotelInput>): Promise<RepositoryResult<Hotel | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const current = allDemoHotels().find((hotel) => hotel.id === id);
    if (!current) return fallback(null, "Hotel non trovato");
    return fallback(
      upsertDemoHotel({
        ...current,
        name: input.name ?? current.name,
        zone: input.location ?? current.zone,
        stars: input.stars ?? current.stars,
        description: input.shortDescription ?? current.description,
        imageUrl: input.imageUrl ?? current.imageUrl,
        standardServices: input.standardServices ?? current.standardServices,
        defaultDepositPercent: input.defaultDepositPercent ?? current.defaultDepositPercent,
        defaultBalanceMethod: input.defaultBalanceMethod ?? current.defaultBalanceMethod,
        defaultPaymentNotes: input.defaultPaymentNotes ?? current.defaultPaymentNotes,
        paymentPolicy: input.paymentPolicy ?? current.paymentPolicy,
        cancellationPolicy: input.cancellationPolicy ?? current.cancellationPolicy,
        internalNotes: input.internalNotes ?? current.internalNotes,
        active: input.isActive ?? current.active
      })
    );
  }

  const { data, error } = await supabase
    .from("hotels")
    .update({ ...toHotelRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return fallback(null, error);
  return fromSupabase(mapHotel(data));
}

export async function deleteHotel(id: string): Promise<RepositoryResult<{ deleted: boolean; reason?: string }>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const result = deleteDemoHotel(id);
    return fallback({ deleted: result.ok, reason: result.reason });
  }

  const linked = await supabase.from("quotes").select("id").or(`hotel_id.eq.${id},alternative_hotel_id.eq.${id}`).limit(1);
  if (linked.error) return fallback({ deleted: false, reason: linked.error.message }, linked.error);
  if (linked.data?.length) return fromSupabase({ deleted: false, reason: "Hotel collegato a preventivi: disattivalo invece di eliminarlo." });

  const { error } = await supabase.from("hotels").delete().eq("id", id);
  if (error) return fallback({ deleted: false, reason: error.message }, error);
  return fromSupabase({ deleted: true });
}

function toHotelRow(input: Partial<HotelInput>) {
  const policies = fillMissingHotelPolicies({
    hotelName: input.name ?? "",
    depositPercent: input.defaultDepositPercent,
    balanceMethod: input.defaultBalanceMethod,
    paymentPolicy: input.paymentPolicy,
    cancellationPolicy: input.cancellationPolicy,
    paymentNotes: input.defaultPaymentNotes
  });
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.stars !== undefined ? { stars: input.stars } : {}),
    ...(input.shortDescription !== undefined ? { short_description: input.shortDescription } : {}),
    ...(input.imageUrl !== undefined ? { image_url: input.imageUrl } : {}),
    ...(input.standardServices !== undefined ? { standard_services: input.standardServices } : {}),
    ...(input.defaultDepositPercent !== undefined || policies.depositPercent !== undefined ? { default_deposit_percent: policies.depositPercent ?? null } : {}),
    ...(input.defaultBalanceMethod !== undefined || policies.balanceMethod ? { default_balance_method: policies.balanceMethod || null } : {}),
    ...(input.defaultPaymentNotes !== undefined || policies.paymentNotes ? { default_payment_notes: policies.paymentNotes || null } : {}),
    ...(input.paymentPolicy !== undefined || policies.paymentPolicy ? { payment_policy: policies.paymentPolicy } : {}),
    ...(input.cancellationPolicy !== undefined || policies.cancellationPolicy ? { cancellation_policy: policies.cancellationPolicy } : {}),
    ...(input.internalNotes !== undefined ? { internal_notes: input.internalNotes } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {})
  };
}

function findMatchingHotel(existingRows: Record<string, any>[], importedHotel: ImportedIschiaStarsHotel) {
  const normalizedImportedName = normalizeHotelName(importedHotel.name);
  const externalMatch = existingRows.find((row) => isWordPressHotelRow(row) && row.external_id && row.external_id === importedHotel.externalId);
  if (externalMatch) return { row: externalMatch, reason: "external_id" };

  const slugMatch = existingRows.find((row) => importedHotel.slug && row.slug === importedHotel.slug);
  if (slugMatch) return { row: slugMatch, reason: "slug" };

  const nameMatch = existingRows.find((row) => normalizeHotelName(row.name ?? "") === normalizedImportedName);
  if (nameMatch) return { row: nameMatch, reason: "name" };

  return null;
}

function toImportedUpdateRow(current: Record<string, any>, importedRow: Record<string, any>) {
  const now = new Date().toISOString();
  const currentMetadata = typeof current.sync_metadata === "object" && current.sync_metadata ? current.sync_metadata : {};
  const importedMetadata = typeof importedRow.sync_metadata === "object" && importedRow.sync_metadata ? importedRow.sync_metadata : {};
  const importedImageUrl = typeof importedMetadata.importedImageUrl === "string" ? importedMetadata.importedImageUrl : undefined;
  const importedExternalImageUrl = typeof importedRow.external_image_url === "string" ? importedRow.external_image_url : importedImageUrl;
  const canSetManualImageSlot = Boolean(importedRow.image_url && !current.image_url);

  return {
    name: importedRow.name,
    location: importedRow.location ?? current.location,
    stars: importedRow.stars ?? current.stars,
    source_url: importedRow.source_url,
    external_source: importedRow.external_source,
    external_id: importedRow.external_id ?? current.external_id,
    slug: importedRow.slug ?? current.slug,
    last_synced_at: now,
    last_seen_on_site_at: now,
    external_image_url: importedExternalImageUrl ?? current.external_image_url ?? null,
    sync_metadata: {
      ...currentMetadata,
      ...importedMetadata,
      ...(importedImageUrl ? { importedImageUrl } : {})
    },
    updated_at: now,
    // Aggiorna solo se il campo e vuoto: non sovrascrivere immagini inserite manualmente.
    ...(!current.short_description && importedRow.short_description ? { short_description: importedRow.short_description } : {}),
    ...(canSetManualImageSlot ? { image_url: importedRow.image_url } : {}),
    ...(isArrayEmpty(current.standard_services) && importedRow.standard_services?.length ? { standard_services: importedRow.standard_services } : {}),
    ...(!current.payment_policy && importedRow.payment_policy ? { payment_policy: importedRow.payment_policy } : {}),
    ...(!current.cancellation_policy && importedRow.cancellation_policy ? { cancellation_policy: importedRow.cancellation_policy } : {})
  };
}

function isWordPressHotelRow(row: Record<string, any>) {
  return row.external_source === "wordpress" || row.external_source === "ischiastars.it" || row.external_source === "lr_hotel_feed";
}

function isArrayEmpty(value: unknown): boolean {
  return !value || (Array.isArray(value) && value.length === 0);
}

function hasMeaningfulImportChanges(current: Record<string, any>, updateRow: Record<string, any>) {
  return Object.entries(updateRow).some(([key, value]) => {
    if (["last_synced_at", "last_seen_on_site_at", "updated_at", "sync_metadata"].includes(key)) return false;
    return JSON.stringify(current[key] ?? null) !== JSON.stringify(value ?? null);
  });
}

// ── LR Hotel Feed sync ───────────────────────────────────────────────────────

export type LrHotelSyncReportItem = {
  externalId: string;
  name: string;
  action: "imported" | "updated" | "skipped";
  sourceUrl: string;
  hasImage: boolean;
  servicesCount: number;
  hasListino: boolean;
};

export type LrHotelSyncReport = {
  schemaVersion: string;
  generatedAt: string;
  cacheStatus: string | null;
  hotelsCount: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  items: LrHotelSyncReportItem[];
};

export async function syncLrHotelFeed(): Promise<RepositoryResult<LrHotelSyncReport>> {
  const supabase = createSupabaseAdminClient();
  const emptyReport: LrHotelSyncReport = {
    schemaVersion: "", generatedAt: "", cacheStatus: null,
    hotelsCount: 0, imported: 0, updated: 0, skipped: 0,
    errors: [], warnings: [], items: [],
  };

  if (!supabase) {
    return { data: emptyReport, source: "mock", error: "La sincronizzazione richiede il collegamento al database." };
  }

  // Fetch feed
  let feed: Awaited<ReturnType<typeof fetchLrHotelQuotesFeed>>;
  try {
    feed = await fetchLrHotelQuotesFeed();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: emptyReport, source: "supabase", error: msg };
  }

  const { feed: feedData, cacheHeader } = feed;

  // Load existing hotels
  const { data: existingRows, error: fetchError } = await supabase.from("hotels").select("*");
  if (fetchError) return { data: emptyReport, source: "supabase", error: fetchError.message };

  const existing = existingRows ?? [];
  const report: LrHotelSyncReport = {
    schemaVersion: feedData.schema_version,
    generatedAt: feedData.generated_at,
    cacheStatus: cacheHeader,
    hotelsCount: feedData.hotels_count,
    imported: 0, updated: 0, skipped: 0,
    errors: [], warnings: [], items: [],
  };

  for (const hotel of feedData.hotels) {
    try {
      const { dbRow, services } = mapLrHotelToDbRow(hotel, cacheHeader, feedData.generated_at, feedData.schema_version);
      const externalId = String(hotel.hotel_id);
      const item: LrHotelSyncReportItem = {
        externalId,
        name: dbRow.name as string,
        action: "skipped",
        sourceUrl: (dbRow.source_url as string) ?? "",
        hasImage: Boolean(dbRow.external_image_url),
        servicesCount: services.length,
        hasListino: Boolean(hotel.listino),
      };

      // Dedup: 1) exact lr_hotel_feed match, 2) any external_id match, 3) slug, 4) normalized name
      const match =
        existing.find((r) => r.external_source === "lr_hotel_feed" && String(r.external_id) === externalId) ??
        existing.find((r) => r.external_id && String(r.external_id) === externalId) ??
        existing.find((r) => hotel.slug && r.slug === hotel.slug) ??
        existing.find((r) => normalizeHotelName(r.name ?? "") === normalizeHotelName(dbRow.name as string));

      if (match) {
        // Safe update: preserve manually edited fields, always update external/sync fields
        const safeUpdate: Record<string, unknown> = {
          ...dbRow,
          // Only update location if currently empty
          location: match.location || dbRow.location,
          // Only update stars if currently unset
          stars: match.stars || dbRow.stars,
          // Merge sync_metadata (feed data wins on existing keys)
          sync_metadata: { ...(typeof match.sync_metadata === "object" ? match.sync_metadata : {}), ...(dbRow.sync_metadata as object) },
          // Only fill services from feed if DB field is currently empty
          ...(isArrayEmpty(match.standard_services) && services.length ? { standard_services: services } : {}),
        };

        const { data: updated, error: updateErr } = await supabase.from("hotels").update(safeUpdate).eq("id", match.id).select("*").single();
        if (updateErr) throw updateErr;

        const idx = existing.findIndex((r) => r.id === match.id);
        if (idx >= 0) existing[idx] = updated;

        item.action = "updated";
        report.updated++;
      } else {
        // Insert new hotel
        const insertRow: Record<string, unknown> = {
          ...dbRow,
          ...(services.length ? { standard_services: services } : {}),
          is_active: true,
        };

        const { data: inserted, error: insertErr } = await supabase.from("hotels").insert(insertRow).select("*").single();
        if (insertErr) throw insertErr;

        existing.push(inserted);
        item.action = "imported";
        report.imported++;
      }

      report.items.push(item);
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (err !== null && typeof err === "object" && "message" in err) ? String((err as { message: unknown }).message)
        : String(err);
      report.errors.push(`Hotel ${hotel.hotel_id} (${hotel.title}): ${msg}`);
    }
  }

  return fromSupabase(report);
}
