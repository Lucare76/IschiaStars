import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { cleanImportedHotelText, isUsefulHotelTextLine } from "@/lib/server/hotel-text-cleaner";
import { decodeHtml, isWpAuthConfigured } from "@/lib/server/ischiastars-hotel-importer";

export const dynamic = "force-dynamic";

const SITE_BASE_URL = "https://ischiastars.it";
const WP_REST = `${SITE_BASE_URL}/wp-json/wp/v2`;
const HOTEL_POST_TYPE = "lr_hotel";
const UA = "IschiaStars backoffice hotel import";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const raw = request.nextUrl.searchParams.get("slug")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Parametro slug mancante" }, { status: 400 });
  }

  const slug = extractSlug(raw);
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Slug non valido" }, { status: 400 });
  }

  const fetched = await fetchHotelHtml(slug);
  if (!fetched.ok) {
    return NextResponse.json({ ok: false, error: fetched.error }, { status: 502 });
  }

  // Se l'API autenticata ha restituito dati strutturati, usali direttamente
  if (fetched.structured) {
    return NextResponse.json({ ok: true, data: fetched.structured });
  }
  return NextResponse.json({ ok: true, data: parseHotelPage(fetched.content) });
}

function extractSlug(input: string): string | null {
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/hotel\/([^/?#]+)/i);
    return match?.[1]?.replace(/\/+$/, "") ?? null;
  } catch {
    return input.replace(/^\/+|\/+$/g, "") || null;
  }
}

type FetchResult = { ok: true; content: string; structured?: StructuredHotelData } | { ok: false; error: string };

type StructuredHotelData = {
  descrizione: string;
  serviziInclusi: string[];
};

async function fetchHotelHtml(slug: string): Promise<FetchResult> {
  const baseHeaders = { "User-Agent": UA };

  // Priorità 1: API WP autenticata (lr_hotel) — restituisce ACF fields
  if (isWpAuthConfigured()) {
    const user = process.env.ISCHIASTARS_WP_USER!;
    const pass = process.env.ISCHIASTARS_WP_APP_PASSWORD!.replace(/\s+/g, "");
    const authHeaders = {
      ...baseHeaders,
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`
    };
    try {
      const res = await fetch(
        `${WP_REST}/${HOTEL_POST_TYPE}?slug=${encodeURIComponent(slug)}&context=edit`,
        { headers: authHeaders, next: { revalidate: 0 } }
      );
      if (res.ok) {
        const posts = (await res.json().catch(() => [])) as Array<{
          acf?: Record<string, unknown>;
          meta?: Record<string, unknown>;
          content?: { rendered?: string };
        }>;
        const post = posts[0];
        if (post) {
          const structured = parseAcfFields(post.acf ?? post.meta ?? {}, post.content?.rendered ?? "");
          if (structured.descrizione || structured.serviziInclusi.length) {
            return { ok: true, content: post.content?.rendered ?? "", structured };
          }
        }
      }
    } catch {
      // continua
    }
  }

  // Priorità 2: API WP non autenticata (lr_hotel, post type corretto)
  try {
    const res = await fetch(
      `${WP_REST}/${HOTEL_POST_TYPE}?slug=${encodeURIComponent(slug)}`,
      { headers: baseHeaders, next: { revalidate: 0 } }
    );
    if (res.ok) {
      const posts = (await res.json().catch(() => [])) as Array<{ content?: { rendered?: string } }>;
      const content = posts[0]?.content?.rendered;
      if (content) return { ok: true, content };
    }
  } catch {
    // continua
  }

  // Priorità 3: fetch HTML pagina completa
  try {
    const pageUrl = `${SITE_BASE_URL}/hotel/${slug}/`;
    const res = await fetch(pageUrl, { headers: baseHeaders, next: { revalidate: 0 } });
    if (!res.ok) {
      return { ok: false, error: `Pagina hotel non trovata (HTTP ${res.status}). Verifica lo slug.` };
    }
    return { ok: true, content: await res.text() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connessione al sito non riuscita" };
  }
}

// Mappa campi ACF/meta quando disponibili via API autenticata
function parseAcfFields(
  src: Record<string, unknown>,
  contentHtml: string
): StructuredHotelData {
  const pick = (...keys: string[]) => keys.map((k) => src[k]).find(Boolean);

  const rawDesc =
    cleanAcf(pick("descrizione", "description", "testo", "body", "contenuto")) ||
    cleanAcf(pick("descrizione_breve", "short_description", "sottotitolo")) ||
    (contentHtml ? cleanImportedHotelText(stripHtmlTags(contentHtml)) : "");

  const rawServices = pick("servizi", "servizi_inclusi", "included_services", "cosa_comprende", "services");
  const serviziInclusi = parseAcfServices(rawServices);

  return {
    descrizione: rawDesc,
    serviziInclusi
  };
}

function cleanAcf(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  return cleanImportedHotelText(stripHtmlTags(value));
}

function parseAcfServices(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(cleanAcf).filter(Boolean) as string[];
  if (typeof value === "string") {
    return value.split(/[\n,;]/).map(cleanAcf).filter(Boolean) as string[];
  }
  return [];
}

function stripHtmlTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseHotelPage(html: string): { descrizione: string; serviziInclusi: string[] } {
  // Step 1: rimuovi elementi di struttura e rumore prima di qualsiasi estrazione
  const sanitized = sanitizeHtml(html);
  // Step 2: isola solo il contenitore hotel, senza header/nav/footer
  const content = isolateHotelContent(sanitized);
  return {
    descrizione: parseDescrizione(content),
    serviziInclusi: parseServizi(content)
  };
}

// Rimuove tag di struttura e i loro contenuti interi — non solo il tag ma tutto l'interno
function sanitizeHtml(html: string): string {
  return html
    // Blocchi con contenuto pericoloso
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    // Elementi strutturali: nav, header, footer, aside — mai contengono descrizioni hotel
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, "")
    // Elementi non testuali
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    // Commenti HTML (possono contenere CSS/JS condizionali)
    .replace(/<!--[\s\S]*?-->/g, "");
}

// Estrae solo il contenitore principale del contenuto hotel, ignorando il resto della pagina
function isolateHotelContent(html: string): string {
  const candidates: RegExp[] = [
    // Article con classe hotel specifica (WordPress post type)
    /<article\b[^>]*class=["'][^"']*(?:post-type-hotel|type-hotel|single-hotel)[^"']*["'][^>]*>([\s\S]*?)<\/article>/i,
    // Div con classi content hotel
    /<div\b[^>]*class=["'][^"']*(?:hotel-content|hotel-page|hotel-detail|hotel-description)[^"']*["'][^>]*>([\s\S]*)/i,
    // WordPress entry-content / post-content
    /<div\b[^>]*class=["'][^"']*(?:entry-content|post-content|page-content|the-content)[^"']*["'][^>]*>([\s\S]*)/i,
    // Tag main
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    // Qualsiasi article
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1] && match[1].trim().length > 80) return match[1];
  }

  return html; // fallback: usa l'HTML già sanitizzato
}

function parseDescrizione(html: string): string {
  // Priorità 1: heading esplicito "Descrizione"
  const afterDescrizioneHeading = html.match(
    /<h[2-6][^>]*>[^<]*[Dd]escrizione[^<]*<\/h[2-6]>([\s\S]*?)(?=<h[2-6]|$)/i
  );
  if (afterDescrizioneHeading) {
    const text = extractParagraphs(afterDescrizioneHeading[1]);
    if (text) return cleanImportedHotelText(text);
  }

  // Priorità 2: div.hotel-sections
  const sectionsBlock = html.match(
    /<[^>]*class=["'][^"']*hotel-section[^"']*["'][^>]*>([\s\S]*?)(?=<\/div>\s*<\/(?:div|section)|$)/i
  );
  if (sectionsBlock) {
    const text = extractParagraphs(sectionsBlock[1]);
    if (text) return cleanImportedHotelText(text);
  }

  // Priorità 3: div WordPress entry-content / hotel-description
  const contentDiv = html.match(
    /<[^>]*class=["'][^"']*(?:entry-content|post-content|hotel-content|hotel-description)[^"']*["'][^>]*>([\s\S]*?)(?=<\/(?:div|section|article)|$)/i
  );
  if (contentDiv) {
    const text = extractParagraphs(contentDiv[1]);
    if (text) return cleanImportedHotelText(text);
  }

  // Priorità 4: heading hotel-like seguito da paragrafi
  const hotelHeadings = /informazioni|descrizione|posizione|camere|servizi|ristorante|struttura|location/i;
  const headingMatches = Array.from(html.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>([\s\S]*?)(?=<h[2-6]|$)/gi));
  for (const section of headingMatches) {
    if (hotelHeadings.test(stripTags(section[1]))) {
      const text = extractParagraphs(section[2]);
      if (text.length >= 40) return cleanImportedHotelText(text);
    }
  }

  // Fallback: paragrafi >= 60 caratteri che superano il filtro qualità
  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length >= 60 && isUsefulHotelTextLine(t));
  return cleanImportedHotelText(paragraphs.slice(0, 4).join("\n\n").trim());
}

function parseServizi(html: string): string[] {
  const servicesPattern = /(?:cosa\s+comprende|servizi?\s+inclu|comprende\s+il\s+soggiorno|cosa\s+include|pacchetto\s+comprende|sono\s+inclusi)/i;

  const sections = Array.from(html.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>([\s\S]*?)(?=<h[2-6]|$)/gi));
  for (const section of sections) {
    if (servicesPattern.test(stripTags(section[1]))) {
      const items = extractListItems(section[2]).filter((item) => isUsefulHotelTextLine(item));
      if (items.length) return items;
    }
  }

  return [];
}

function isBoilerplate(text: string): boolean {
  return (
    /\b081[\s.]?90[\s.]?54[\s.]?81\b/.test(text) ||
    /\b371[\s.]?75[\s.]?90[\s.]?017\b/.test(text) ||
    /\b(?:instagram|facebook|whatsapp|envelope|twitter|youtube)\b/i.test(text) ||
    /\b(?:cookie|privacy|copyright|all rights reserved|p\.iva|partita iva)\b/i.test(text)
  );
}

function extractParagraphs(html: string): string {
  return Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 10 && !isBoilerplate(t))
    .join("\n\n")
    .trim();
}

function extractListItems(html: string): string[] {
  return Array.from(html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .filter((m) => !isNavListItem(m[1]))
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
}

function isNavListItem(itemHtml: string): boolean {
  return /^\s*<a\b[^>]*>[\s\S]*?<\/a>\s*$/.test(itemHtml.trim());
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
