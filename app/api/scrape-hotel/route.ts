import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { decodeHtml } from "@/lib/server/ischiastars-hotel-importer";

export const dynamic = "force-dynamic";

const SITE_BASE_URL = "https://ischiastars.it";
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

async function fetchHotelHtml(slug: string): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const headers = { "User-Agent": UA };

  for (const postType of ["hotel", "hotels"]) {
    try {
      const res = await fetch(`${SITE_BASE_URL}/wp-json/wp/v2/${postType}?slug=${encodeURIComponent(slug)}`, {
        headers,
        next: { revalidate: 0 }
      });
      if (res.ok) {
        const posts = (await res.json().catch(() => [])) as Array<{ content?: { rendered?: string } }>;
        const content = posts[0]?.content?.rendered;
        if (content) return { ok: true, content };
      }
    } catch {
      // continua con il prossimo tentativo
    }
  }

  try {
    const pageUrl = `${SITE_BASE_URL}/hotel/${slug}/`;
    const res = await fetch(pageUrl, { headers, next: { revalidate: 0 } });
    if (!res.ok) {
      return { ok: false, error: `Pagina hotel non trovata (HTTP ${res.status}). Verifica lo slug.` };
    }
    return { ok: true, content: await res.text() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connessione al sito non riuscita" };
  }
}

function parseHotelPage(html: string): { descrizione: string; serviziInclusi: string[] } {
  // Rimuove blocchi <style> e <script> compreso il loro contenuto, prima di qualsiasi parsing
  const clean = sanitizeHtml(html);
  return {
    descrizione: parseDescrizione(clean),
    serviziInclusi: parseServizi(clean)
  };
}

// Elimina tutto il contenuto di <style>, <script>, <noscript> (non solo i tag)
function sanitizeHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
}

function parseDescrizione(html: string): string {
  // Cerca testo dopo un heading "Descrizione"
  const afterHeading = html.match(/<h[2-6][^>]*>[^<]*[Dd]escrizione[^<]*<\/h[2-6]>([\s\S]*?)(?=<h[2-6]|$)/i);
  if (afterHeading) {
    const text = extractParagraphs(afterHeading[1]);
    if (text) return text;
  }

  // Cerca le sezioni hotel (struttura di ischiastars.it: div.hotel-sections)
  const sectionsBlock = html.match(/class=["'][^"']*hotel-section[^"']*["'][^>]*>([\s\S]*?)(?=<\/div>\s*<\/(?:div|section)|$)/i);
  if (sectionsBlock) {
    const text = extractParagraphs(sectionsBlock[1]);
    if (text) return text;
  }

  // Cerca nei div di contenuto WordPress standard
  const contentDiv = html.match(
    /class=["'][^"']*(?:entry-content|post-content|hotel-content|hotel-description)[^"']*["'][^>]*>([\s\S]*?)(?=<\/(?:div|section|article)|$)/i
  );
  if (contentDiv) {
    const text = extractParagraphs(contentDiv[1]);
    if (text) return text;
  }

  // Fallback: paragrafi lunghi che sembrano testo descrittivo (>= 60 car, non numeri di telefono o social)
  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length >= 60 && !isBoilerplate(t));
  return paragraphs.slice(0, 4).join("\n\n").trim();
}

function parseServizi(html: string): string[] {
  const servicesPattern = /(?:cosa\s+comprende|servizi?\s+inclu|comprende\s+il\s+soggiorno|cosa\s+include|pacchetto\s+comprende|sono\s+inclusi)/i;

  const sections = Array.from(html.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>([\s\S]*?)(?=<h[2-6]|$)/gi));
  for (const section of sections) {
    if (servicesPattern.test(stripTags(section[1]))) {
      const items = extractListItems(section[2]);
      if (items.length) return items;
    }
  }

  return [];
}

// Testo boilerplate da escludere: telefoni, social, copyright, cookie
function isBoilerplate(text: string): boolean {
  return /\d{3}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}/.test(text) ||
    /\b(?:instagram|facebook|whatsapp|envelope|twitter|youtube)\b/i.test(text) ||
    /\b(?:cookie|privacy|copyright|all rights reserved|p\.iva|partita iva)\b/i.test(text);
}

function extractParagraphs(html: string): string {
  return Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 10)
    .join("\n\n")
    .trim();
}

function extractListItems(html: string): string[] {
  return Array.from(html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .filter((m) => !isNavListItem(m[1]))
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
}

// Voce di menu: il contenuto è solo un <a> link
function isNavListItem(itemHtml: string): boolean {
  return /^\s*<a\b[^>]*>[\s\S]*?<\/a>\s*$/.test(itemHtml.trim());
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
