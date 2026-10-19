import { NextRequest, NextResponse } from "next/server";
import type { RepositoryResult } from "@/lib/repositories/shared";
import type { Quote } from "@/lib/types";

type QuoteByCodeDeps = {
  authorize: (request: NextRequest) => Promise<NextResponse | null>;
  getQuoteByCode: (code: string) => Promise<RepositoryResult<Quote | null>>;
};

const NO_STORE = { "Cache-Control": "no-store" };

// Handler read-only: le dipendenze sono iniettate per poterlo verificare senza Supabase.
export function createQuoteByCodeHandler({ authorize, getQuoteByCode }: QuoteByCodeDeps) {
  return async function GET(request: NextRequest) {
    const unauthorized = await authorize(request);
    if (unauthorized) return unauthorized;

    const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
    if (!code) {
      return NextResponse.json({ ok: false, error: "Codice preventivo obbligatorio" }, { status: 400, headers: NO_STORE });
    }

    try {
      const result = await getQuoteByCode(code);
      if (result.error) {
        // Il dettaglio tecnico resta nei log del server, non nella risposta.
        console.error(`Lettura preventivo ${code} non riuscita: ${result.error}`);
        return NextResponse.json({ ok: false, error: "Lettura preventivo non riuscita" }, { status: 503, headers: NO_STORE });
      }
      if (!result.data) {
        return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404, headers: NO_STORE });
      }

      return NextResponse.json({ ok: true, data: result.data }, { headers: NO_STORE });
    } catch (error) {
      console.error(`Lettura preventivo ${code} non riuscita:`, error);
      return NextResponse.json({ ok: false, error: "Lettura preventivo non riuscita" }, { status: 500, headers: NO_STORE });
    }
  };
}
