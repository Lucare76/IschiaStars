import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Recupero password temporaneamente non disponibile. Contatta il referente tecnico." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Inserisci un indirizzo email valido." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Recupero password non disponibile." }, { status: 503 });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteBaseUrl()}/reset-password`
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "Non siamo riusciti a inviare il link di reset." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Controlla la tua email per reimpostare la password." });
}

function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000").replace(/\/+$/, "");
}
