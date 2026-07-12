import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { buildDepositBalanceSummaryEmail } from "@/lib/server/brevo";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addPrintToolbar(html: string, quoteCode: string): string {
  const toolbar = `<div class="no-print" style="max-width:620px;margin:0 auto 16px;padding:12px 14px;background:#ffffff;border:1px solid #D9E2EC;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.08);font-family:Arial,Helvetica,sans-serif;color:#1B3A5C;display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <div style="font-size:13px;font-weight:bold;">Anteprima riepilogo saldo ${escapeHtml(quoteCode)}</div>
    <button type="button" onclick="window.print()" style="border:0;border-radius:999px;background:#1B3A5C;color:#ffffff;font-size:13px;font-weight:bold;padding:9px 16px;cursor:pointer;">Stampa</button>
  </div>`;

  return html.replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  const confirmation = confirmationResult.data;
  if (!confirmation) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });

  const quoteResult = await getQuoteById(String(confirmation.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const preview = buildDepositBalanceSummaryEmail(quote);
  if (!preview) {
    return NextResponse.json({ ok: false, error: "Anteprima riepilogo saldo non disponibile" }, { status: 409 });
  }

  return new NextResponse(addPrintToolbar(preview.html, quote.code), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="riepilogo-saldo-${quote.code}.html"`
    }
  });
}
