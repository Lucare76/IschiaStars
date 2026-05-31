import { NextRequest, NextResponse } from "next/server";
import { createQuoteConfirmation } from "@/lib/repositories/quoteConfirmations";
import { getQuoteByCodeAndToken } from "@/lib/repositories/quotes";
import { sendQuoteConfirmedInternalEmail } from "@/lib/server/brevo";

type ConfirmationPayload = {
  quoteCode?: string;
  token?: string;
  firstName?: string;
  lastName?: string;
  fiscalCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  children?: { id?: string; birthDate?: string }[];
  selectedHotelOptionId?: string;
  selectedHotelName?: string;
  selectedTreatmentKey?: string;
  selectedTreatmentLabel?: string;
  selectedPrice?: number;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ConfirmationPayload | null;
  const validationError = validateConfirmation(body);
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });

  console.info(`[confirmation] start code=${body!.quoteCode}`);

  const quoteResult = await getQuoteByCodeAndToken(body!.quoteCode!, body!.token!);
  if (!quoteResult.data) return NextResponse.json({ ok: false, error: "Preventivo non trovato o link non valido" }, { status: 404 });
  if (quoteResult.data.deletedAt) return NextResponse.json({ ok: false, error: "Preventivo non disponibile" }, { status: 410 });

  const expectedChildren = quoteResult.data.children.length;
  if (expectedChildren > 0 && (body!.children?.filter((c) => Boolean(c.birthDate)).length ?? 0) < expectedChildren) {
    return NextResponse.json({ ok: false, error: "Inserisci la data di nascita per ogni bambino" }, { status: 400 });
  }

  const result = await createQuoteConfirmation(quoteResult.data.id, {
    firstName: body!.firstName!.trim(),
    lastName: body!.lastName!.trim(),
    fiscalCode: body!.fiscalCode!.trim(),
    phone: body!.phone!.trim(),
    email: body!.email!.trim(),
    address: body!.address!.trim(),
    city: body!.city!.trim(),
    postalCode: body!.postalCode!.trim(),
    province: body!.province!.trim(),
    acceptedTerms: Boolean(body!.acceptedTerms),
    acceptedPrivacy: Boolean(body!.acceptedPrivacy),
    selectedHotelOptionId: body!.selectedHotelOptionId,
    selectedHotelName: body!.selectedHotelName,
    selectedTreatmentKey: body!.selectedTreatmentKey,
    selectedTreatmentLabel: body!.selectedTreatmentLabel,
    selectedPrice: body!.selectedPrice,
    metadata: {
      children: body!.children ?? [],
      source: "public_quote_page"
    }
  });

  if (!result.data) return NextResponse.json({ ok: false, error: result.error ?? "Conferma non salvata" }, { status: 500 });
  console.info(`[confirmation] saved quote=${quoteResult.data.id} code=${quoteResult.data.code}`);

  try {
    await sendQuoteConfirmedInternalEmail(quoteResult.data, {
      firstName: body!.firstName!.trim(),
      lastName: body!.lastName!.trim(),
      fiscalCode: body!.fiscalCode!.trim(),
      phone: body!.phone!.trim(),
      email: body!.email!.trim(),
      address: body!.address!.trim(),
      city: body!.city!.trim(),
      postalCode: body!.postalCode!.trim(),
      province: body!.province!.trim(),
      confirmedAt: result.data.confirmedAt,
      children: body!.children ?? [],
      selectedHotelName: body!.selectedHotelName,
      selectedTreatmentLabel: body!.selectedTreatmentLabel,
      selectedPrice: body!.selectedPrice
    });
  } catch (err) {
    console.warn("POST /api/quote-confirmations brevo error", { code: quoteResult.data.code, message: err instanceof Error ? err.message : String(err) });
  }

  return NextResponse.json({ ok: true, source: result.source, confirmedAt: result.data.confirmedAt });
}

function validateConfirmation(body: ConfirmationPayload | null) {
  if (!body?.quoteCode || !body.token) return "Link preventivo non valido";
  const required = [body.firstName, body.lastName, body.fiscalCode, body.phone, body.email, body.address, body.city, body.postalCode, body.province];
  if (required.some((v) => !v?.trim())) return "Compila tutti i campi obbligatori";
  if (body.fiscalCode!.trim().length < 11) return "Codice fiscale troppo breve";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email!.trim())) return "Email non valida";
  if (!/^\d{5}$/.test(body.postalCode!.trim())) return "CAP non valido";
  if (!body.acceptedTerms || !body.acceptedPrivacy) return "Accetta condizioni e privacy";
  return null;
}
