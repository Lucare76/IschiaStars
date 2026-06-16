import { NextRequest, NextResponse } from "next/server";
import { normalizeAnnouncementSettings } from "@/lib/announcement-settings";
import { getAnnouncementSettings, updateAnnouncementSettings } from "@/lib/repositories/settings";
import { getAdminSession } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  void request;
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });

  const result = await getAnnouncementSettings();
  return NextResponse.json({ ok: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  if (session.role !== "supervisor") {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Dati non validi" }, { status: 400 });
  }

  const settings = normalizeAnnouncementSettings(body);
  const result = await updateAnnouncementSettings(settings);
  if (result.source !== "supabase") {
    const detail = result.error ? ` (${result.error})` : "";
    return NextResponse.json({ ok: false, error: `Salvataggio non riuscito${detail}` }, { status: 503 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
