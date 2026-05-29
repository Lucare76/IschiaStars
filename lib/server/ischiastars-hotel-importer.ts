import "server-only";

const SITE_BASE_URL = "https://ischiastars.it";
const HOTELS_PAGE_URL = `${SITE_BASE_URL}/hotels/`;
const HOTEL_POST_TYPE = "lr_hotel";
const WP_REST = `${SITE_BASE_URL}/wp-json/wp/v2`;
const UA = "IschiaStars backoffice hotel sync";

export type ImportedIschiaStarsHotel = {
  name: string;
  location?: string;
  stars?: number;
  shortDescription?: string;
  description?: string;
  standardServices?: string[];
  paymentPolicy?: string;
  cancellationPolicy?: string;
  imageUrl?: string;
  sourceUrl?: string;
  externalSource: "ischiastars.it";
  externalId?: string;
  slug?: string;
  wpId?: number;
  metadata?: Record<string, unknown>;
};

// ── Autenticazione WordPress ──────────────────────────────────────────────────

export function isWpAuthConfigured(): boolean {
  return Boolean(process.env.ISCHIASTARS_WP_USER && process.env.ISCHIASTARS_WP_APP_PASSWORD);
}

function wpAuthHeaders(): Record<string, string> {
  const user = process.env.ISCHIASTARS_WP_USER!;
  const pass = process.env.ISCHIASTARS_WP_APP_PASSWORD!.replace(/\s+/g, "");
  const encoded = Buffer.from(`${user}:${pass}`).toString("base64");
  return { Authorization: `Basic ${encoded}`, "User-Agent": UA };
}

// ── Entry point pubblico ──────────────────────────────────────────────────────

export async function fetchIschiaStarsHotels(): Promise<ImportedIschiaStarsHotel[]> {
  // Priorità 1: REST API (autenticata o no) — dati strutturati, nessun parsing HTML
  const apiHotels = await fetchHotelsFromRestApi();
  if (apiHotels.length) return dedupeImportedHotels(apiHotels);

  // Priorità 2: pagina hotels HTML (fallback per compatibilità)
  const sources = await fetchHotelHtmlSources();
  const hotels = sources.flatMap((s) => parseIschiaStarsHotels(s.html, s.url));
  return dedupeImportedHotels(hotels);
}

// ── REST API: recupero hotel strutturati ─────────────────────────────────────

async function fetchHotelsFromRestApi(): Promise<ImportedIschiaStarsHotel[]> {
  const useAuth = isWpAuthConfigured();
  const headers = useAuth ? wpAuthHeaders() : { "User-Agent": UA };
  const context = useAuth ? "&context=edit" : "";

  try {
    const res = await fetch(
      `${WP_REST}/${HOTEL_POST_TYPE}?per_page=100&_embed=1${context}`,
      { headers, next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const posts = (await res.json()) as WpHotelPost[];
    if (!Array.isArray(posts) || !posts.length) return [];
    return posts.map((post) => mapWpApiHotel(post, useAuth)).filter(Boolean) as ImportedIschiaStarsHotel[];
  } catch {
    return [];
  }
}

// ── Mapping WP REST → ImportedIschiaStarsHotel ────────────────────────────────

type WpHotelPost = {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  featured_media?: number;
  acf?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string; media_details?: { sizes?: Record<string, { source_url: string }> } }>;
    "wp:term"?: Array<Array<{ id: number; name: string; slug: string; taxonomy: string }>>;
  };
};

function mapWpApiHotel(post: WpHotelPost, withAuth: boolean): ImportedIschiaStarsHotel | null {
  const rawTitle = decodeHtml(post.title?.rendered ?? "").replace(/<[^>]+>/g, " ").trim();
  if (!rawTitle) return null;

  const { name, stars: titleStars } = extractNameAndStars(rawTitle);
  if (!name) return null;

  const location = extractLocation(post);
  const imageUrl = extractImageUrl(post);
  const sourceUrl = post.link || `${SITE_BASE_URL}/hotel/${post.slug}/`;
  const slug = post.slug || slugify(name);

  const base: ImportedIschiaStarsHotel = {
    name,
    location,
    stars: titleStars,
    imageUrl,
    sourceUrl,
    externalSource: "ischiastars.it",
    externalId: slug,
    slug,
    wpId: post.id,
    metadata: {
      importedFrom: `${WP_REST}/${HOTEL_POST_TYPE}`,
      importedImageUrl: imageUrl,
      nameNormalized: normalizeHotelName(name),
      wpId: post.id,
      withAuth
    }
  };

  if (!withAuth) return base;

  // Con autenticazione: mappa campi ACF e meta
  const acfData = mapAcfFields(post.acf, post.meta);
  return {
    ...base,
    stars: acfData.stars ?? titleStars,
    shortDescription: acfData.shortDescription || undefined,
    description: acfData.description || undefined,
    standardServices: acfData.standardServices?.length ? acfData.standardServices : undefined,
    paymentPolicy: acfData.paymentPolicy || undefined,
    cancellationPolicy: acfData.cancellationPolicy || undefined
  };
}

// Estrae stelle e nome pulito dal titolo WP
// "Roulette Ischia Porto 4 ⭐ (spiaggia inclusa)" → { name: "Roulette Ischia Porto", stars: 4 }
function extractNameAndStars(raw: string): { name: string; stars?: number } {
  const starsMatch = raw.match(/(\d)\s*[⭐★]/);
  const stars = starsMatch ? Number(starsMatch[1]) : undefined;

  const name = raw
    .replace(/\s*\d\s*[⭐★]\s*/g, " ")   // rimuove "4 ⭐"
    .replace(/\([^)]*\)/g, " ")            // rimuove "(spiaggia inclusa)" ecc.
    .replace(/\s+/g, " ")
    .trim();

  return { name, stars };
}

// Zona dalla tassonomia embedded
function extractLocation(post: WpHotelPost): string | undefined {
  const terms = post._embedded?.["wp:term"]?.[0] ?? [];
  const dest = terms.find((t) => t.taxonomy === "lr_destinazione");
  if (dest?.name) return dest.name;
  return undefined;
}

// URL immagine principale dalla media embedded
function extractImageUrl(post: WpHotelPost): string | undefined {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) return undefined;
  return (
    media.source_url ||
    media.media_details?.sizes?.large?.source_url ||
    media.media_details?.sizes?.full?.source_url
  );
}

// Mapping ACF/meta con supporto per nomi di campo comuni
function mapAcfFields(acf?: Record<string, unknown>, meta?: Record<string, unknown>): {
  stars?: number;
  shortDescription?: string;
  description?: string;
  standardServices?: string[];
  paymentPolicy?: string;
  cancellationPolicy?: string;
} {
  const src = acf ?? meta ?? {};

  const stars = parseStarsField(
    src["stelle"] ?? src["stars"] ?? src["categoria_stelle"] ?? src["star_rating"] ?? src["categoria"]
  );

  const shortDescription = cleanAcfText(
    src["descrizione_breve"] ?? src["short_description"] ?? src["sottotitolo"] ?? src["tagline"]
  );

  // Tenta più varianti del campo descrizione; se content.rendered non è vuoto lo usa come fallback
  const description = cleanAcfText(
    src["descrizione"] ?? src["description"] ?? src["testo"] ?? src["body"] ?? src["contenuto"]
  );

  const standardServices = parseServicesField(
    src["servizi"] ?? src["servizi_inclusi"] ?? src["included_services"] ?? src["cosa_comprende"] ?? src["services"]
  );

  const paymentPolicy = cleanAcfText(
    src["policy_pagamento"] ?? src["payment_policy"] ?? src["modalita_pagamento"] ?? src["pagamento"]
  );

  const cancellationPolicy = cleanAcfText(
    src["policy_cancellazione"] ?? src["cancellation_policy"] ?? src["cancellazione"] ?? src["condizioni_cancellazione"]
  );

  return { stars, shortDescription, description, standardServices, paymentPolicy, cancellationPolicy };
}

function parseStarsField(value: unknown): number | undefined {
  if (!value) return undefined;
  const n = Number(String(value).replace(/[^\d]/g, ""));
  return n >= 1 && n <= 5 ? n : undefined;
}

function parseServicesField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(cleanAcfText).filter(Boolean) as string[];
  if (typeof value === "string") return value.split(/[\n,;]/).map(cleanAcfText).filter(Boolean) as string[];
  return [];
}

function cleanAcfText(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// ── Mapping verso DB ──────────────────────────────────────────────────────────

export function mapImportedHotelToDbHotel(hotel: ImportedIschiaStarsHotel) {
  return {
    name: hotel.name,
    location: hotel.location ?? "Ischia",
    stars: hotel.stars ?? 3,
    short_description: hotel.shortDescription ?? hotel.description ?? "",
    image_url: hotel.imageUrl,
    source_url: hotel.sourceUrl,
    external_source: hotel.externalSource,
    external_id: hotel.externalId,
    slug: hotel.slug,
    is_active: true,
    last_synced_at: new Date().toISOString(),
    last_seen_on_site_at: new Date().toISOString(),
    sync_metadata: hotel.metadata ?? {},
    ...(hotel.standardServices?.length ? { standard_services: hotel.standardServices } : {}),
    ...(hotel.paymentPolicy ? { payment_policy: hotel.paymentPolicy } : {}),
    ...(hotel.cancellationPolicy ? { cancellation_policy: hotel.cancellationPolicy } : {})
  };
}

// ── Normalizzazione nomi per dedup e match ────────────────────────────────────

export function normalizeHotelName(name: string) {
  return decodeHtml(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " e ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ── Fallback: fetch HTML della pagina hotels ──────────────────────────────────

async function fetchHotelHtmlSources() {
  const headers = { "User-Agent": UA };
  const sources: { url: string; html: string }[] = [];

  // Prova API WP (pagina hotels)
  const apiRes = await fetch(`${WP_REST}/pages?slug=hotels`, { headers, next: { revalidate: 0 } }).catch(() => null);
  if (apiRes?.ok) {
    const pages = (await apiRes.json().catch(() => [])) as Array<{ content?: { rendered?: string }; link?: string }>;
    for (const page of pages) {
      if (page.content?.rendered) sources.push({ url: page.link ?? HOTELS_PAGE_URL, html: page.content.rendered });
    }
  }

  if (!sources.length) {
    const pageRes = await fetch(HOTELS_PAGE_URL, { headers, next: { revalidate: 0 } }).catch(() => null);
    if (!pageRes?.ok) return sources;
    sources.push({ url: HOTELS_PAGE_URL, html: await pageRes.text() });
  }

  return sources;
}

export function parseIschiaStarsHotels(html: string, sourceUrl = HOTELS_PAGE_URL): ImportedIschiaStarsHotel[] {
  const articleMatches = Array.from(html.matchAll(/<article\b[^>]*class=["'][^"']*hotel-finder__card[^"']*["'][^>]*>[\s\S]*?<\/article>/gi));

  if (articleMatches.length) {
    return articleMatches.map((match) => parseHotelCard(match[0], sourceUrl)).filter(Boolean) as ImportedIschiaStarsHotel[];
  }

  return parseHotelLinks(html, sourceUrl);
}

function parseHotelCard(cardHtml: string, pageUrl: string): ImportedIschiaStarsHotel | null {
  const titleMatch = cardHtml.match(/<h3\b[^>]*class=["'][^"']*hotel-finder__title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const fallbackTitleMatch = cardHtml.match(/aria-label=["']Vai all(?:'|&#039;)hotel\s+([^"']+)["']/i);
  const rawName = cleanText(titleMatch?.[2] ?? fallbackTitleMatch?.[1] ?? "");
  if (!rawName) return null;

  const { name, stars } = extractNameAndStars(rawName);
  if (!name) return null;

  const sourceUrl = absolutizeUrl(titleMatch?.[1] ?? firstAttribute(cardHtml, "href") ?? pageUrl);
  const childLocation = cleanText(firstClassContent(cardHtml, "hotel-finder__destination-children"));
  const parentLocation = cleanText(firstClassContent(cardHtml, "hotel-finder__destination-parent"));
  const location = [parentLocation, childLocation].filter(Boolean).join(" - ") || undefined;
  const resolvedStars = stars ?? (Number(cardHtml.match(/aria-label=["'](\d)\s+stelle["']/i)?.[1] ?? "") || undefined);
  const imageUrl = absolutizeUrl(firstAttribute(cardHtml, "src"));
  const slug = slugFromUrl(sourceUrl) ?? slugify(name);

  return {
    name,
    location,
    stars: resolvedStars,
    imageUrl,
    sourceUrl,
    externalSource: "ischiastars.it",
    externalId: slug,
    slug,
    metadata: { importedFrom: pageUrl, importedImageUrl: imageUrl, nameNormalized: normalizeHotelName(name) }
  };
}

function parseHotelLinks(html: string, pageUrl: string): ImportedIschiaStarsHotel[] {
  return Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']*\/hotel\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      const rawName = cleanText(match[2]);
      const { name, stars } = extractNameAndStars(rawName);
      const sourceUrl = absolutizeUrl(match[1]);
      const slug = slugFromUrl(sourceUrl) ?? slugify(name);
      if (!name || !slug) return null;
      return {
        name,
        stars,
        sourceUrl,
        externalSource: "ischiastars.it" as const,
        externalId: slug,
        slug,
        metadata: { importedFrom: pageUrl, nameNormalized: normalizeHotelName(name) }
      };
    })
    .filter(Boolean) as ImportedIschiaStarsHotel[];
}

// ── Deduplicazione ────────────────────────────────────────────────────────────

function dedupeImportedHotels(hotels: ImportedIschiaStarsHotel[]) {
  const seen = new Set<string>();
  return hotels.filter((hotel) => {
    const key = hotel.externalId ?? normalizeHotelName(hotel.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Utility HTML ──────────────────────────────────────────────────────────────

function firstClassContent(html: string, className: string) {
  return html.match(new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"))?.[1] ?? "";
}

function firstAttribute(html: string, attribute: string) {
  return html.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, "i"))?.[1];
}

function slugFromUrl(url?: string) {
  if (!url) return undefined;
  const match = url.match(/\/hotel\/([^/?#]+)/i);
  return match?.[1] ? slugify(match[1]) : undefined;
}

function slugify(value: string) {
  return normalizeHotelName(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&", nbsp: " ", quot: "\"", apos: "'", lt: "<", gt: ">",
    egrave: "e", agrave: "a", igrave: "i", ograve: "o", ugrave: "u"
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => named[String(entity).toLowerCase()] ?? match);
}

function absolutizeUrl(url?: string) {
  if (!url) return undefined;
  try { return new URL(url, SITE_BASE_URL).toString(); } catch { return undefined; }
}
