import { allDemoHotels, deleteDemoHotel, upsertDemoHotel } from "@/lib/demo-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ImportedIschiaStarsHotel, mapImportedHotelToDbHotel, normalizeHotelName } from "@/lib/server/ischiastars-hotel-importer";
import { Hotel } from "@/lib/types";
import { fallback, fromSupabase, mapHotel, RepositoryResult } from "@/lib/repositories/shared";

export type HotelInput = {
  name: string;
  location: string;
  stars: number;
  shortDescription?: string;
  imageUrl?: string;
  standardServices?: string[];
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
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.stars !== undefined ? { stars: input.stars } : {}),
    ...(input.shortDescription !== undefined ? { short_description: input.shortDescription } : {}),
    ...(input.imageUrl !== undefined ? { image_url: input.imageUrl } : {}),
    ...(input.standardServices !== undefined ? { standard_services: input.standardServices } : {}),
    ...(input.paymentPolicy !== undefined ? { payment_policy: input.paymentPolicy } : {}),
    ...(input.cancellationPolicy !== undefined ? { cancellation_policy: input.cancellationPolicy } : {}),
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
  return row.external_source === "wordpress" || row.external_source === "ischiastars.it";
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
