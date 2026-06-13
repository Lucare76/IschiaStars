import { NextRequest, NextResponse } from "next/server";
import { calculatePaymentBreakdown } from "@/lib/hotel-policies";
import {
  createQuoteConfirmation,
  getQuoteConfirmation,
  updateQuoteConfirmationAvailability
} from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const quoteResult = await getQuoteById(params.id);
  const quote = quoteResult.data;
  if (!quote) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });
  if (quote.confirmation) return NextResponse.json({ ok: false, error: "Il preventivo risulta già confermato" }, { status: 409 });
  if (!quote.customerFirstName.trim() || !quote.customerLastName.trim() || !quote.customerPhone.trim() || !quote.customerEmail.trim()) {
    return NextResponse.json({ ok: false, error: "Nome, cognome, telefono ed email cliente sono obbligatori" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.customerEmail.trim())) {
    return NextResponse.json({ ok: false, error: "Indirizzo email cliente non valido" }, { status: 400 });
  }

  const pricedTreatments = quote.hotelOptions.flatMap((option) =>
    option.treatments
      .filter((treatment) => treatment.price > 0)
      .map((treatment) => ({ option, treatment }))
  );
  if (pricedTreatments.length !== 1) {
    return NextResponse.json(
      { ok: false, error: "Per importare una conferma via email inserisci una sola struttura e un solo trattamento con prezzo" },
      { status: 400 }
    );
  }

  const { option, treatment } = pricedTreatments[0];
  const breakdown = calculatePaymentBreakdown(treatment.price, option.depositPercent, option.balanceMethod);
  const confirmationResult = await createQuoteConfirmation(quote.id, {
    firstName: quote.customerFirstName.trim(),
    lastName: quote.customerLastName.trim(),
    fiscalCode: "",
    phone: quote.customerPhone.trim(),
    email: quote.customerEmail.trim(),
    address: "",
    city: "",
    postalCode: "",
    province: "",
    acceptedTerms: false,
    acceptedPrivacy: false,
    selectedHotelOptionId: option.id,
    selectedHotelName: option.hotelName,
    selectedTreatmentKey: treatment.key,
    selectedTreatmentLabel: treatment.label,
    selectedPrice: treatment.price,
    selectedDepositPercent: breakdown.depositPercent,
    selectedDepositAmount: breakdown.depositAmount,
    selectedBalanceAmount: breakdown.balanceAmount,
    selectedBalanceMethod: breakdown.balanceMethod,
    selectedPaymentPolicy: option.paymentPolicy,
    selectedCancellationPolicy: option.cancellationPolicy,
    metadata: {
      source: "manual_email_import",
      imported_by_operator: true
    }
  });
  if (!confirmationResult.data) {
    return NextResponse.json({ ok: false, error: confirmationResult.error ?? "Conferma non salvata" }, { status: 500 });
  }

  const storedConfirmation = await getQuoteConfirmation(quote.id);
  const confirmationId = storedConfirmation.data?.id ? String(storedConfirmation.data.id) : "";
  if (!confirmationId) {
    return NextResponse.json({ ok: false, error: "Conferma creata ma non recuperabile" }, { status: 500 });
  }

  const availabilityUpdate = await updateQuoteConfirmationAvailability(confirmationId, {
    status: "deposit_waiting",
    finalConfirmationNotes: "Prenotazione importata manualmente da conferma ricevuta via email."
  });
  if (!availabilityUpdate.data) {
    return NextResponse.json({ ok: false, error: availabilityUpdate.error ?? "Stato conferma non aggiornato" }, { status: 500 });
  }

  const freshQuoteResult = await getQuoteById(quote.id);
  return NextResponse.json({ ok: true, quote: freshQuoteResult.data });
}
