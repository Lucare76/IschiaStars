import { NextRequest, NextResponse } from "next/server";
import { formatConfirmationAdditionalService, getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";
import { generateVoucherPdf } from "@/lib/pdf/generateVoucher";
import { getQuoteConfirmationById, markBalancePaid } from "@/lib/repositories/quoteConfirmations";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendVoucherEmailToClient } from "@/lib/server/brevo";
import { formatClientName, formatCurrency, formatDate, formatDateTime, ischiastarsWhatsappNumber } from "@/lib/utils";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) return NextResponse.json({ ok: false, error: "Conferma non trovata" }, { status: 404 });
  if (!confirmationResult.data.deposit_paid_at) {
    return NextResponse.json({ ok: false, error: "Il saldo può essere registrato solo dopo la caparra" }, { status: 409 });
  }

  const quoteResult = await getQuoteById(String(confirmationResult.data.quote_id));
  const quote = quoteResult.data;
  if (!quote?.confirmation) return NextResponse.json({ ok: false, error: "Preventivo non trovato" }, { status: 404 });

  const update = await markBalancePaid(params.id);
  if (!update.data) return NextResponse.json({ ok: false, error: update.error ?? "Saldo non registrato" }, { status: 500 });

  const balancePaidAt = String(update.data.balance_paid_at ?? new Date().toISOString());
  const confirmation = quote.confirmation;

  const guestsParts: string[] = [];
  if (quote.adults) guestsParts.push(`${quote.adults} ${quote.adults === 1 ? "adulto" : "adulti"}`);
  if (quote.children?.length) guestsParts.push(`${quote.children.length} ${quote.children.length === 1 ? "bambino" : "bambini"}`);

  const depositAmount = confirmation.selectedDepositAmount ?? quote.deposit;
  const balanceAmount = confirmation.selectedBalanceAmount;
  const depositPaidAt = confirmation.depositPaidAt ?? balancePaidAt;

  const selectedOption = quote.hotelOptions.find(o => o.id === confirmation.selectedHotelOptionId);
  const includedServices = selectedOption?.includedServices
    ? selectedOption.includedServices.split("\n").map(s => s.trim()).filter(Boolean)
    : (quote.servicesIncluded ?? []);
  includedServices.push(...getConfirmationAdditionalServices(confirmation.metadata).map(formatConfirmationAdditionalService));

  let nightsCount: number | undefined;
  if (quote.arrivalDate && quote.departureDate) {
    const nights = Math.round(
      (new Date(quote.departureDate).getTime() - new Date(quote.arrivalDate).getTime()) / 86400000
    );
    if (nights > 0) nightsCount = nights;
  }

  try {
    const pdfBuffer = await generateVoucherPdf({
      quoteCode: quote.code,
      clientFullName: formatClientName(confirmation.firstName ?? quote.customerFirstName, confirmation.lastName ?? quote.customerLastName),
      clientEmail: confirmation.email ?? quote.customerEmail,
      clientPhone: confirmation.phone ?? quote.customerPhone,
      hotelName: confirmation.selectedHotelName,
      roomTypeLabel: selectedOption?.roomTypeLabel ?? undefined,
      treatmentLabel: confirmation.selectedTreatmentLabel,
      arrivalDate: quote.arrivalDate ? formatDate(quote.arrivalDate) : undefined,
      departureDate: quote.departureDate ? formatDate(quote.departureDate) : undefined,
      nightsCount,
      guestsLabel: guestsParts.length ? guestsParts.join(", ") : undefined,
      includedServices,
      depositAmountLabel: typeof depositAmount === "number" ? formatCurrency(depositAmount) : "—",
      depositPaidAtLabel: formatDateTime(depositPaidAt),
      balanceAmountLabel: typeof balanceAmount === "number" ? formatCurrency(balanceAmount) : undefined,
      balanceMethodLabel: confirmation.selectedBalanceMethod,
      cancellationPolicy: confirmation.selectedCancellationPolicy ?? quote.cancellationPolicy,
      voucherNotes: confirmation.voucherNotes,
      whatsappNumber: ischiastarsWhatsappNumber()
    });

    await sendVoucherEmailToClient(quote, pdfBuffer.toString("base64"));
  } catch (error) {
    console.error("[balance-received] voucher generation/sending failed", error);
  }

  const freshQuoteResult = await getQuoteById(quote.id);
  return NextResponse.json({ ok: true, balancePaidAt, quote: freshQuoteResult.data });
}
