import "server-only";

// ── Feed types ───────────────────────────────────────────────────────────────

export type LrHotelImage = {
  attachment_id: number | null;
  url: string;
  alt: string;
  title: string;
};

export type LrHotelService = {
  key: string;
  label: string;
};

export type LrHotelSection = {
  title: string;
  content_html: string;
  content_text: string;
};

export type LrHotelListinoPrice = {
  nights_min: number | null;
  nights_max: number | null;
  nights_label: string;
  multi_treatment: boolean;
  price_generic: string | null;
  price_bb: string | null;
  price_hb: string | null;
  price_fb: string | null;
};

export type LrHotelListinoRow = {
  date_start: string;
  date_end: string;
  show_price: boolean;
  row_title: string;
  row_description_html: string;
  row_description_text: string;
  prices: LrHotelListinoPrice[];
};

export type LrHotelListino = {
  listino_id: number;
  title: string;
  description_html: string;
  description_text: string;
  rows: LrHotelListinoRow[];
  modified_gmt: string;
};

export type LrHotelItem = {
  hotel_id: number;
  slug: string;
  title: string;
  permalink: string;
  status: string;
  featured: boolean;
  featured_rank: number;
  stars: number;
  image: LrHotelImage;
  gallery: LrHotelImage[];
  destinations: string[];
  services: LrHotelService[];
  maps_url: string;
  content_html: string;
  content_text: string;
  sections: LrHotelSection[];
  listino: LrHotelListino | null;
  modified_gmt: string;
};

export type LrHotelFeed = {
  schema_version: string;
  generated_at: string;
  site: string;
  hotels_count: number;
  hotels: LrHotelItem[];
};

export type LrHotelMapped = {
  /** DB-safe row for Supabase upsert */
  dbRow: Record<string, unknown>;
  /** Decoded service labels for standard_services (only applied when DB field is empty) */
  services: string[];
};

// ── Config ───────────────────────────────────────────────────────────────────

const EXPECTED_SCHEMA_VERSION = "1.0.0";
const FEED_PATH = "/wp-json/lr-hotel/v1/quotes-feed";
const TIMEOUT_MS = 20_000;

// ── Auth ─────────────────────────────────────────────────────────────────────

function buildAuthHeader(): string {
  const user = process.env.WORDPRESS_USERNAME;
  const pass = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) throw new Error("[lr-hotel] Missing WORDPRESS_USERNAME or WORDPRESS_APP_PASSWORD");
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchLrHotelQuotesFeed(): Promise<{ feed: LrHotelFeed; cacheHeader: string | null }> {
  const baseUrl = (process.env.WORDPRESS_BASE_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("[lr-hotel] Missing WORDPRESS_BASE_URL");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${FEED_PATH}`, {
      method: "GET",
      headers: { Authorization: buildAuthHeader(), Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    console.warn("[lr-hotel] auth failed status=401");
    throw new Error("[lr-hotel] auth failed status=401");
  }
  if (res.status === 403) {
    console.warn("[lr-hotel] forbidden status=403");
    throw new Error("[lr-hotel] forbidden status=403");
  }
  if (!res.ok) {
    console.warn(`[lr-hotel] sync failed status=${res.status}`);
    throw new Error(`[lr-hotel] sync failed status=${res.status}`);
  }

  const cacheHeader = res.headers.get("X-LR-Hotel-Cache");
  if (cacheHeader) console.info(`[lr-hotel] cache=${cacheHeader}`);

  const payload = await res.json() as unknown;
  const feed = validateLrHotelFeed(payload);
  console.info(`[lr-hotel] feed fetched hotels=${feed.hotels.length}`);
  return { feed, cacheHeader };
}

// ── Validate ─────────────────────────────────────────────────────────────────

export function validateLrHotelFeed(payload: unknown): LrHotelFeed {
  if (!payload || typeof payload !== "object") {
    throw new Error("[lr-hotel] Feed response is not an object");
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.schema_version !== "string") {
    throw new Error("[lr-hotel] Missing schema_version in feed");
  }
  if (p.schema_version !== EXPECTED_SCHEMA_VERSION) {
    console.warn(`[lr-hotel] schema_version mismatch: expected=${EXPECTED_SCHEMA_VERSION} got=${p.schema_version} — proceeding if compatible`);
  }
  if (!Array.isArray(p.hotels)) {
    throw new Error("[lr-hotel] hotels field is not an array");
  }
  if (typeof p.hotels_count === "number" && (p.hotels_count as number) !== (p.hotels as unknown[]).length) {
    console.warn(`[lr-hotel] hotels_count=${p.hotels_count} does not match hotels.length=${(p.hotels as unknown[]).length}`);
  }

  return p as unknown as LrHotelFeed;
}

// ── Map ───────────────────────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return (text ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

export function mapLrHotelToDbRow(
  hotel: LrHotelItem,
  cacheHeader: string | null,
  generatedAt: string,
  schemaVersion: string
): LrHotelMapped {
  const now = new Date().toISOString();
  const name = decodeEntities(hotel.title);
  const location = hotel.destinations?.find((d) => typeof d === "string" && d.trim()) ?? undefined;
  const services = (hotel.services ?? []).map((s) => decodeEntities(s.label)).filter(Boolean);

  const listinoCompact = hotel.listino
    ? {
        listino_id: hotel.listino.listino_id,
        title: decodeEntities(hotel.listino.title),
        description_text: hotel.listino.description_text || null,
        rows_count: hotel.listino.rows.length,
        rows: hotel.listino.rows.map((row) => ({
          date_start: row.date_start,
          date_end: row.date_end,
          row_title: row.row_title,
          row_description_text: row.row_description_text || null,
          show_price: row.show_price,
          prices: row.prices.map((p) => ({
            nights_label: p.nights_label,
            nights_min: p.nights_min,
            nights_max: p.nights_max,
            price_bb: p.price_bb || null,
            price_hb: p.price_hb || null,
            price_fb: p.price_fb || null,
            price_generic: p.price_generic || null,
          })),
        })),
      }
    : null;

  const dbRow: Record<string, unknown> = {
    name,
    location: location || null,
    stars: hotel.stars || null,
    source_url: hotel.permalink || null,
    external_source: "lr_hotel_feed",
    external_id: String(hotel.hotel_id),
    slug: hotel.slug || null,
    external_image_url: hotel.image?.url || null,
    last_synced_at: now,
    last_seen_on_site_at: now,
    updated_at: now,
    sync_metadata: {
      schema_version: schemaVersion,
      generated_at: generatedAt,
      cache_header: cacheHeader,
      hotel_id: hotel.hotel_id,
      featured: hotel.featured,
      featured_rank: hotel.featured_rank,
      destinations: hotel.destinations ?? [],
      services: hotel.services ?? [],
      image: hotel.image ?? null,
      gallery: hotel.gallery ?? [],
      maps_url: hotel.maps_url || null,
      external_modified_at: hotel.modified_gmt || null,
      sections: (hotel.sections ?? []).map((s) => ({
        title: s.title,
        content_text: s.content_text || null,
      })),
      listino: listinoCompact,
    },
  };

  return { dbRow, services };
}
