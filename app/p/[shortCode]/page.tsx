import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicQuoteLinkError } from "@/components/PublicQuoteLinkError";
import { getQuoteByShortCode } from "@/lib/repositories/quotes";
import { generateQuoteMetadataFromQuote, renderPublicQuote } from "@/app/preventivi/[code]/page";

export const dynamic = "force-dynamic";

const defaultMetadata: Metadata = {
  title: "Preventivo IschiaStars",
  description: "La tua proposta personalizzata per una vacanza a Ischia.",
  robots: { index: false, follow: false }
};

export async function generateMetadata({ params }: { params: { shortCode: string } }): Promise<Metadata> {
  const shortCode = safeDecode(params.shortCode);
  if (!shortCode || !/^[0-9a-f]{16}$/.test(shortCode)) return defaultMetadata;

  const result = await getQuoteByShortCode(shortCode);
  const quote = result.data;
  if (!quote || quote.deletedAt) return defaultMetadata;

  return generateQuoteMetadataFromQuote(quote);
}

export default async function ShortQuotePage({ params }: { params: { shortCode: string } }) {
  const requestHeaders = headers();
  const decodedShortCode = safeDecode(params.shortCode);
  const shortCode = decodedShortCode ?? "";
  const baseLog = {
    shortCode,
    userAgent: requestHeaders.get("user-agent"),
    openedAt: new Date().toISOString(),
    referrer: requestHeaders.get("referer")
  };

  if (!/^[0-9a-f]{16}$/.test(shortCode)) {
    logShortLink({ ...baseLog, quoteId: null, outcome: decodedShortCode === null || shortCode ? "invalid" : "missing" });
    return <PublicQuoteLinkError />;
  }

  const result = await getQuoteByShortCode(shortCode);
  const quote = result.data;
  if (!quote || quote.deletedAt) {
    logShortLink({ ...baseLog, quoteId: quote?.id ?? null, outcome: "invalid" });
    return <PublicQuoteLinkError />;
  }
  logShortLink({ ...baseLog, quoteId: quote.id, outcome: "success" });
  return renderPublicQuote(quote, "whatsapp");
}

function safeDecode(value: string | undefined) {
  try {
    return decodeURIComponent(value ?? "").trim().toLowerCase();
  } catch {
    return null;
  }
}

function logShortLink(entry: Record<string, unknown>) {
  console.info("[short-quote-link]", JSON.stringify(entry));
}
