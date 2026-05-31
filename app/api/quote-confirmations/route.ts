import { NextRequest, NextResponse } from "next/server";
import { BALANCE_METHOD_IN_STRUCTURE, calculatePaymentBreakdown } from "@/lib/hotel-policies";
import { buildPaymentReason, isPaymentSettingsConfigured, paymentSettingsToDbValue } from "@/lib/payment-settings";
import { createQuoteConfirmation } from "@/lib/repositories/quoteConfirmations";
import { getQuoteByCodeAndToken } from "@/lib/repositories/quotes";
import { getPaymentSettings } from "@/lib/repositories/settings";
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

  const selection = resolveSelection(quoteResult.data, body!);
  const paymentSettingsResult = await getPaymentSettings();
  const paymentSettings = paymentSettingsResult.data;
  const paymentReason = buildPaymentReason(paymentSettings, quoteResult.data.code, body!.firstName!.trim(), body!.lastName!.trim());
  const paymentSettingsSnapshot = isPaymentSettingsConfigured(paymentSettings)
    ? { ...paymentSettingsToDbValue(paymentSettings), payment_reason: paymentReason, configured: true }
    : { configured: false, payment_reason: paymentReason, updated_at: paymentSettings.updatedAt };

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
    selectedHotelOptionId: selection.selectedHotelOptionId,
    selectedHotelName: selection.selectedHotelName,
    selectedTreatmentKey: selection.selectedTreatmentKey,
    selectedTreatmentLabel: selection.selectedTreatmentLabel,
    selectedPrice: selection.selectedPrice,
    selectedDepositPercent: selection.selectedDepositPercent,
    selectedDepositAmount: selection.selectedDepositAmount,
    selectedBalanceAmount: selection.selectedBalanceAmount,
    selectedBalanceMethod: selection.selectedBalanceMethod,
    selectedPaymentPolicy: selection.selectedPaymentPolicy,
    selectedCancellationPolicy: selection.selectedCancellationPolicy,
    paymentSettingsSnapshot,
    metadata: {
      children: body!.children ?? [],
      source: "public_quote_page",
      paymentSettingsSnapshot
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
      selectedHotelName: selection.selectedHotelName,
      selectedTreatmentLabel: selection.selectedTreatmentLabel,
      selectedPrice: selection.selectedPrice,
      selectedDepositPercent: selection.selectedDepositPercent,
      selectedDepositAmount: selection.selectedDepositAmount,
      selectedBalanceAmount: selection.selectedBalanceAmount,
      selectedBalanceMethod: selection.selectedBalanceMethod,
      selectedPaymentPolicy: selection.selectedPaymentPolicy,
      selectedCancellationPolicy: selection.selectedCancellationPolicy,
      paymentSettingsSnapshot
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

function resolveSelection(quote: NonNullable<Awaited<ReturnType<typeof getQuoteByCodeAndToken>>["data"]>, body: ConfirmationPayload) {
  const option = body.selectedHotelOptionId
    ? quote.hotelOptions.find((item) => item.id === body.selectedHotelOptionId)
    : undefined;
  const treatment = option?.treatments.find((item) => item.key === body.selectedTreatmentKey);
  const selectedPrice = treatment?.price ?? body.selectedPrice;
  const breakdown = selectedPrice != null
    ? calculatePaymentBreakdown(selectedPrice, option?.depositPercent, option?.balanceMethod || BALANCE_METHOD_IN_STRUCTURE)
    : null;

  return {
    selectedHotelOptionId: option?.id ?? body.selectedHotelOptionId,
    selectedHotelName: option ? option.hotelName + (option.roomTypeLabel ? ` — ${option.roomTypeLabel}` : "") : body.selectedHotelName,
    selectedTreatmentKey: treatment?.key ?? body.selectedTreatmentKey,
    selectedTreatmentLabel: treatment?.label ?? body.selectedTreatmentLabel,
    selectedPrice,
    selectedDepositPercent: breakdown?.depositPercent,
    selectedDepositAmount: breakdown?.depositAmount,
    selectedBalanceAmount: breakdown?.balanceAmount,
    selectedBalanceMethod: breakdown?.balanceMethod,
    selectedPaymentPolicy: option?.paymentPolicy,
    selectedCancellationPolicy: option?.cancellationPolicy
  };
}
