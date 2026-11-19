import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getQuoteById } from "@/lib/repositories/quotes";
import { normalizeTranslations } from "@/lib/i18n/quote-language";
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null);
  if (!body || !["it", "en"].includes(body.language))
    return NextResponse.json(
      { ok: false, error: "Lingua non valida" },
      { status: 400 },
    );
  const db = createSupabaseAdminClient();
  if (!db)
    return NextResponse.json(
      { ok: false, error: "Database non disponibile" },
      { status: 503 },
    );
  const result = await db.rpc("set_quote_localization", {
    p_quote_id: params.id,
    p_language: body.language,
    p_translations: normalizeTranslations(body.translations),
  });
  if (result.error)
    return NextResponse.json(
      { ok: false, error: "Traduzioni non salvate" },
      { status: 500 },
    );
  const quote = (await getQuoteById(params.id)).data;
  if (quote) {
    revalidatePath(`/admin/preventivi/${quote.code}`);
    revalidatePath(`/preventivi/${quote.code}`);
    if (quote.publicShortCode) revalidatePath(`/p/${quote.publicShortCode}`);
  }
  return NextResponse.json({ ok: true, quote });
}
