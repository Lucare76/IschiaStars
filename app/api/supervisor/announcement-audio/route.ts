import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "announcement-audio";
const FILE_KEY = "conferma-song";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/m4a", "audio/x-m4a"];

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  if (session.role !== "supervisor") return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") as File | null;

  if (!file) return NextResponse.json({ ok: false, error: "File non trovato" }, { status: 400 });
  if (!file.type.startsWith("audio/") && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Formato non valido. Carica un file audio (MP3, WAV, OGG, M4A)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File troppo grande. Massimo 10 MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Storage non disponibile" }, { status: 503 });

  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => null);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const path = `${FILE_KEY}.${ext}`;

  // Remove any previously uploaded file with a different extension
  const { data: existing } = await supabase.storage.from(BUCKET).list("", { search: FILE_KEY });
  if (existing?.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((f) => f.name));
  }

  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: `Upload non riuscito: ${error.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, data: { url: publicUrl } });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  if (session.role !== "supervisor") return NextResponse.json({ ok: false, error: "Accesso non autorizzato" }, { status: 403 });

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Storage non disponibile" }, { status: 503 });

  const { data: existing } = await supabase.storage.from(BUCKET).list("", { search: FILE_KEY });
  if (existing?.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((f) => f.name));
  }

  return NextResponse.json({ ok: true });
}
