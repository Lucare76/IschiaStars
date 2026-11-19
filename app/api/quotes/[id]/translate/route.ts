import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { getQuoteById } from "@/lib/repositories/quotes";
import {
  normalizeTranslations,
  missingEnglishTranslations,
  translateQuoteText,
} from "@/lib/i18n/quote-language";
import {
  TranslationError,
  translateMissingTexts,
} from "@/lib/server/deepl-translation";
export const maxDuration = 60;
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    (body.customSource !== undefined &&
      (typeof body.customSource !== "string" ||
        body.customSource.length > 12000))
  )
    return NextResponse.json(
      { ok: false, error: "Dati di traduzione non validi" },
      { status: 400 },
    );
  const result = await getQuoteById(params.id);
  if (result.source !== "supabase" || !result.data || result.data.deletedAt)
    return NextResponse.json(
      { ok: false, error: "Preventivo non disponibile" },
      { status: 404 },
    );
  const translations = {
    ...result.data.englishTranslations,
    ...normalizeTranslations(body.translations),
  };
  const missing = missingEnglishTranslations({
    ...result.data,
    englishTranslations: translations,
  });
  const custom =
    typeof body.customSource === "string" ? body.customSource.trim() : "";
  if (custom && translateQuoteText(custom, translations) === undefined)
    missing.push(custom);
  try {
    const generated = await translateMissingTexts(
      missing,
      process.env.DEEPL_API_KEY,
    );
    return NextResponse.json(
      {
        ok: true,
        translations: { ...translations, ...generated },
        translatedCount: Object.keys(generated).length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof TranslationError
            ? error.message
            : "Traduzione non riuscita. I testi già scritti sono stati mantenuti.",
      },
      { status: error instanceof TranslationError ? error.status : 500 },
    );
  }
}
