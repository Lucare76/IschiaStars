import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicQuoteLinkError } from "@/components/PublicQuoteLinkError";
import { getQuoteByShortCode } from "@/lib/repositories/quotes";
import { renderPublicQuote } from "@/app/preventivi/[code]/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preventivo IschiaStars",
  description: "La tua proposta personalizzata per una vacanza a Ischia.",
  robots: { index: false, follow: false }
};

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
  if (isExpired(quote.offerExpiresAt)) {
    logShortLink({ ...baseLog, quoteId: quote.id, outcome: "expired" });
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

function isExpired(value: string) {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  return date < today;
}

function logShortLink(entry: Record<string, unknown>) {
  console.info("[short-quote-link]", JSON.stringify(entry));
}
