import { NextRequest, NextResponse } from "next/server";
import { ExtraServiceEmailItemInput } from "@/lib/extra-service-email-items";
import { listExtraServiceEmailItems, saveExtraServiceEmailItems } from "@/lib/repositories/extraServiceEmailItems";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await listExtraServiceEmailItems();
  return NextResponse.json({ ok: result.source === "supabase", source: result.source, data: result.data, error: result.error });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const validation = validateItems(body?.items);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const result = await saveExtraServiceEmailItems(validation.items);
  return NextResponse.json({
    ok: result.source === "supabase",
    source: result.source,
    data: result.data,
    error: result.error ?? (result.source !== "supabase" ? "Database non collegato: modifiche non salvate." : undefined)
  }, { status: result.source === "supabase" ? 200 : 503 });
}

function validateItems(value: unknown): { ok: true; items: ExtraServiceEmailItemInput[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length > 50) return { ok: false, error: "Elenco servizi non valido" };

  const items: ExtraServiceEmailItemInput[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Voce servizio non valida" };
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const priceSuffix = typeof item.priceSuffix === "string" ? item.priceSuffix.trim() : "";
    const priceFrom = Number(item.priceFrom);
    const sortOrder = Number(item.sortOrder);

    if (!/^[0-9a-f-]{36}$/i.test(id) || ids.has(id)) return { ok: false, error: "Identificativo servizio non valido" };
    if (!title || title.length > 180) return { ok: false, error: "Il nome servizio è obbligatorio e deve essere breve" };
    if (description.length > 300 || priceSuffix.length > 80) return { ok: false, error: "Descrizione o suffisso prezzo troppo lungo" };
    if (!Number.isFinite(priceFrom) || priceFrom < 0 || priceFrom > 100000) return { ok: false, error: "Prezzo non valido" };
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) return { ok: false, error: "Ordinamento non valido" };

    ids.add(id);
    items.push({ id, title, description, priceFrom, priceSuffix: priceSuffix || "a persona", isActive: item.isActive === true, sortOrder });
  }
  return { ok: true, items };
}
