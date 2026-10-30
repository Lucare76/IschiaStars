import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { verifySupplierSmtp } from "@/lib/server/supplier-smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  try {
    await verifySupplierSmtp();
    return NextResponse.json({ ok: true, message: "Connessione SMTP e autenticazione riuscite. Nessuna email inviata." }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Verifica SMTP non riuscita: controllare configurazione, credenziali e collegamento al server." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
