import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "hotel-media";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase non configurato" }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const scope = typeof formData?.get("scope") === "string" ? String(formData?.get("scope")) : "hotel";

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Seleziona una foto da caricare" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Formato non supportato. Usa JPG, PNG, WebP o AVIF." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La foto deve essere inferiore a 8 MB." }, { status: 400 });
  }

  const bucketResult = await supabase.storage.getBucket(BUCKET);
  if (bucketResult.error) {
    const createResult = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_TYPES)
    });
    if (createResult.error && !/already exists/i.test(createResult.error.message)) {
      return NextResponse.json({ ok: false, error: "Impossibile preparare l'archivio immagini." }, { status: 500 });
    }
  }

  const extension = fileExtension(file);
  const safeScope = scope === "room" ? "rooms" : "hotels";
  const path = `${safeScope}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const uploadResult = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false
  });

  if (uploadResult.error) {
    console.error("[hotel-media] upload failed", uploadResult.error);
    return NextResponse.json({ ok: false, error: "Caricamento foto non riuscito." }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/avif") return "avif";
  return "jpg";
}
