import { NextRequest, NextResponse } from "next/server";
import { renderFollowUpTemplate, selectFollowUpTemplate } from "@/lib/follow-up-settings";
import { getFollowUpQuotes } from "@/lib/repositories/followUp";
import { getFollowUpSettings } from "@/lib/repositories/followUpSettings";
import { getQuoteByShortCode } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { absoluteShortPublicQuoteUrl, formatCurrency, formatDate } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { shortCode?: unknown } | null;
  const shortCode = typeof body?.shortCode === "string" ? body.shortCode.trim() : "";
  if (!shortCode) {
    return NextResponse.json({ ok: false, error: "Codice breve preventivo mancante" }, { status: 400 });
  }

  const [quoteResult, settingsResult] = await Promise.all([
    getQuoteByShortCode(shortCode),
    getFollowUpSettings()
  ]);
  const quote = quoteResult.data;
  if (!quote || quote.deletedAt) {
    return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });
  }

  const followUps = await getFollowUpQuotes({ limit: 120 });
  const followUp = followUps.data.quotes.find((item) => item.id === quote.id);
  const template = selectFollowUpTemplate(settingsResult.data, followUp?.segment);
  const publicUrl = absoluteShortPublicQuoteUrl(quote);
  const hotel = followUp?.hotelsSummary || quote.proposedHotel?.name || quote.requestedHotel || "";
  const price = followUp?.mainOffer || formatCurrency(quote.totalPrice);

  const message = renderFollowUpTemplate(template.message, {
    nome: quote.customerFirstName?.trim() || "Cliente",
    codice: quote.code,
    hotel,
    arrivo: formatDate(quote.arrivalDate),
    partenza: formatDate(quote.departureDate),
    prezzo,
    link_preventivo: publicUrl
  });

  return NextResponse.json({
    ok: true,
    message,
    templateKey: template.key,
    segment: followUp?.segment ?? null
  });
}
