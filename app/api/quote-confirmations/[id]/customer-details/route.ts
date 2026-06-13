import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, updateConfirmationCustomerDetails } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById, updateQuote } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

type CustomerDetailsBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as CustomerDetailsBody | null;
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!firstName || !lastName || !email || !phone) {
    return NextResponse.json({ success: false, error: "Compila nome, cognome, email e telefono" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Indirizzo email non valido" }, { status: 400 });
  }
  if (firstName.length > 100 || lastName.length > 100 || email.length > 254 || phone.length > 50) {
    return NextResponse.json({ success: false, error: "Uno o più dati cliente sono troppo lunghi" }, { status: 400 });
  }

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) {
    return NextResponse.json({ success: false, error: "Conferma non trovata" }, { status: 404 });
  }

  const quoteId = String(confirmationResult.data.quote_id);
  const confirmationUpdate = await updateConfirmationCustomerDetails(params.id, { firstName, lastName, email, phone });
  if (!confirmationUpdate.data) {
    return NextResponse.json({ success: false, error: confirmationUpdate.error ?? "Dati cliente non salvati" }, { status: 500 });
  }

  const quoteUpdate = await updateQuote(quoteId, {
    clientFirstName: firstName,
    clientLastName: lastName,
    clientEmail: email,
    clientPhone: phone
  });
  if (!quoteUpdate.data) {
    return NextResponse.json({ success: false, error: quoteUpdate.error ?? "Dati preventivo non sincronizzati" }, { status: 500 });
  }

  const freshQuoteResult = await getQuoteById(quoteId);
  return NextResponse.json({ success: true, quote: freshQuoteResult.data });
}
