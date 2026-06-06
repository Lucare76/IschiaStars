import { NextRequest, NextResponse } from "next/server";
import { getQuoteByCodeAndToken } from "@/lib/repositories/quotes";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { QuoteEvent } from "@/lib/types";

const allowedEvents: QuoteEvent["eventType"][] = [
  "quote_opened",
  "whatsapp_clicked",
  "confirm_clicked",
  "quote_confirmed",
  "print_clicked",
  "hotel_link_clicked",
  "details_opened",
  "follow_up_whatsapp_click",
  "compare_opened",
  "reveal_options_clicked"
];

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { quoteCode?: string; token?: string; eventType?: QuoteEvent["eventType"]; metadata?: Record<string, unknown> } | null;

  if (!body?.quoteCode || !body.token || !body.eventType || !allowedEvents.includes(body.eventType)) {
    return NextResponse.json({ ok: false, error: "Evento preventivo non valido" }, { status: 400 });
  }

  const quoteResult = await getQuoteByCodeAndToken(body.quoteCode, body.token);
  if (!quoteResult.data) {
    return NextResponse.json({ ok: false, error: "Preventivo non trovato o token non valido" }, { status: 404 });
  }
  if (quoteResult.data.deletedAt) {
    return NextResponse.json({ ok: false, error: "Preventivo non disponibile" }, { status: 410 });
  }

  await trackQuoteEvent(quoteResult.data.id, body.eventType, body.metadata ?? {}, request.headers.get("user-agent") ?? undefined);
  return NextResponse.json({ ok: true, source: quoteResult.source });
}
