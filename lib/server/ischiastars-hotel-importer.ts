import "server-only";

const SITE_BASE_URL = "https://ischiastars.it";
const HOTELS_PAGE_URL = `${SITE_BASE_URL}/hotels/`;
const HOTELS_PAGE_API_URL = `${SITE_BASE_URL}/wp-json/wp/v2/pages?slug=hotels`;

export type ImportedIschiaStarsHotel = {
  name: string;
  location?: string;
  stars?: number;
  shortDescription?: string;
  imageUrl?: string;
  sourceUrl?: string;
  externalSource: "ischiastars.it";
  externalId?: string;
  slug?: string;
  metadata?: Record<string, unknown>;
};

export async function fetchIschiaStarsHotels(): Promise<ImportedIschiaStarsHotel[]> {
  const sources = await fetchHotelSources();
  const hotels = sources.flatMap((source) => parseIschiaStarsHotels(source.html, source.url));
  return dedupeImportedHotels(hotels);
}

export function parseIschiaStarsHotels(html: string, sourceUrl = HOTELS_PAGE_URL): ImportedIschiaStarsHotel[] {
  const articleMatches = Array.from(html.matchAll(/<article\b[^>]*class=["'][^"']*hotel-finder__card[^"']*["'][^>]*>[\s\S]*?<\/article>/gi));

  if (articleMatches.length) {
    return articleMatches.map((match) => parseHotelCard(match[0], sourceUrl)).filter(Boolean) as ImportedIschiaStarsHotel[];
  }

  return parseHotelLinks(html, sourceUrl);
}

export function normalizeHotelName(name: string) {
  return decodeHtml(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " e ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function mapImportedHotelToDbHotel(hotel: ImportedIschiaStarsHotel) {
  return {
    name: hotel.name,
    location: hotel.location ?? "Ischia",
    stars: hotel.stars ?? 3,
    short_description: hotel.shortDescription ?? "",
    image_url: hotel.imageUrl,
    source_url: hotel.sourceUrl,
    external_source: hotel.externalSource,
    external_id: hotel.externalId,
    slug: hotel.slug,
    is_active: true,
    last_synced_at: new Date().toISOString(),
    last_seen_on_site_at: new Date().toISOString(),
    sync_metadata: hotel.metadata ?? {}
  };
}

async function fetchHotelSources() {
  const headers = { "User-Agent": "IschiaStars backoffice hotel sync" };
  const sources: { url: string; html: string }[] = [];

  const apiResponse = await fetch(HOTELS_PAGE_API_URL, { headers, next: { revalidate: 0 } });
  if (apiResponse.ok) {
    const pages = (await apiResponse.json().catch(() => [])) as Array<{ content?: { rendered?: string }; link?: string }>;
    for (const page of pages) {
      if (page.content?.rendered) sources.push({ url: page.link ?? HOTELS_PAGE_URL, html: page.content.rendered });
    }
  }

  if (!sources.length) {
    const pageResponse = await fetch(HOTELS_PAGE_URL, { headers, next: { revalidate: 0 } });
    if (!pageResponse.ok) throw new Error("Pagina hotel IschiaStars non raggiungibile");
    sources.push({ url: HOTELS_PAGE_URL, html: await pageResponse.text() });
  }

  return sources;
}

function parseHotelCard(cardHtml: string, pageUrl: string): ImportedIschiaStarsHotel | null {
  const titleMatch = cardHtml.match(/<h3\b[^>]*class=["'][^"']*hotel-finder__title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const fallbackTitleMatch = cardHtml.match(/aria-label=["']Vai all(?:'|&#039;)hotel\s+([^"']+)["']/i);
  const name = cleanText(titleMatch?.[2] ?? fallbackTitleMatch?.[1] ?? "");
  if (!name) return null;

  const sourceUrl = absolutizeUrl(titleMatch?.[1] ?? firstAttribute(cardHtml, "href") ?? pageUrl);
  const childLocation = cleanText(firstClassContent(cardHtml, "hotel-finder__destination-children"));
  const parentLocation = cleanText(firstClassContent(cardHtml, "hotel-finder__destination-parent"));
  const location = [parentLocation, childLocation].filter(Boolean).join(" - ") || undefined;
  const stars = Number(cardHtml.match(/aria-label=["'](\d)\s+stelle["']/i)?.[1] ?? "") || undefined;
  const imageUrl = absolutizeUrl(firstAttribute(cardHtml, "src"));
  const slug = slugFromUrl(sourceUrl) ?? slugify(name);

  return {
    name,
    location,
    stars,
    imageUrl,
    sourceUrl,
    externalSource: "ischiastars.it",
    externalId: slug,
    slug,
    metadata: {
      importedFrom: pageUrl,
      importedImageUrl: imageUrl,
      nameNormalized: normalizeHotelName(name)
    }
  };
}

function parseHotelLinks(html: string, pageUrl: string): ImportedIschiaStarsHotel[] {
  return Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']*\/hotel\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      const name = cleanText(match[2]);
      const sourceUrl = absolutizeUrl(match[1]);
      const slug = slugFromUrl(sourceUrl) ?? slugify(name);
      if (!name || !slug) return null;
      return {
        name,
        sourceUrl,
        externalSource: "ischiastars.it" as const,
        externalId: slug,
        slug,
        metadata: {
          importedFrom: pageUrl,
          nameNormalized: normalizeHotelName(name)
        }
      };
    })
    .filter(Boolean) as ImportedIschiaStarsHotel[];
}

function dedupeImportedHotels(hotels: ImportedIschiaStarsHotel[]) {
  const seen = new Set<string>();
  return hotels.filter((hotel) => {
    const key = hotel.externalId ?? normalizeHotelName(hotel.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
    amp: "&",
    nbsp: " ",
    quot: "\"",
    apos: "'",
    lt: "<",
    gt: ">",
    egrave: "e",
    agrave: "a",
    igrave: "i",
    ograve: "o",
    ugrave: "u"
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => named[String(entity).toLowerCase()] ?? match);
}

function absolutizeUrl(url?: string) {
  if (!url) return undefined;
  try {
    return new URL(url, SITE_BASE_URL).toString();
  } catch {
    return undefined;
  }
}
