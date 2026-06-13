import { NextRequest, NextResponse } from "next/server";
import { getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";
import { getQuoteConfirmationById, updateConfirmationAmounts } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

type UpdateAmountsBody = {
  newTotalPrice?: number;
  depositAmount?: number;
  balanceAmount?: number;
  serviceLabel?: unknown;
  serviceCost?: unknown;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as UpdateAmountsBody | null;
  const newTotalPrice = Number(body?.newTotalPrice);
  const depositAmount = Number(body?.depositAmount);
  const balanceAmount = Number(body?.balanceAmount);
  const serviceLabel = typeof body?.serviceLabel === "string" ? body.serviceLabel.trim() : "";
  const serviceCost = body?.serviceCost === undefined || body.serviceCost === null || body.serviceCost === ""
    ? undefined
    : Number(body.serviceCost);

  if (!Number.isFinite(newTotalPrice) || newTotalPrice <= 0) {
    return NextResponse.json({ success: false, error: "Nuovo totale non valido" }, { status: 400 });
  }
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return NextResponse.json({ success: false, error: "Caparra non valida" }, { status: 400 });
  }
  if (!Number.isFinite(balanceAmount) || balanceAmount < 0) {
    return NextResponse.json({ success: false, error: "Saldo non valido" }, { status: 400 });
  }
  if (Math.abs((newTotalPrice - depositAmount) - balanceAmount) > 0.01) {
    return NextResponse.json({ success: false, error: "Saldo non coerente con totale e caparra" }, { status: 400 });
  }
  if (serviceCost !== undefined && !Number.isFinite(serviceCost)) {
    return NextResponse.json({ success: false, error: "Costo aggiuntivo non valido" }, { status: 400 });
  }
  if (serviceCost !== undefined && serviceCost < 0) {
    return NextResponse.json({ success: false, error: "Costo aggiuntivo non valido" }, { status: 400 });
  }
  if (serviceLabel.length > 150) {
    return NextResponse.json({ success: false, error: "Descrizione servizio troppo lunga" }, { status: 400 });
  }

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) {
    return NextResponse.json({ success: false, error: "Conferma non trovata" }, { status: 404 });
  }

  const oldTotal = confirmationResult.data.selected_price != null
    ? Number(confirmationResult.data.selected_price)
    : Number(confirmationResult.data.selected_deposit_amount ?? 0) + Number(confirmationResult.data.selected_balance_amount ?? 0);
  const quoteId = String(confirmationResult.data.quote_id);
  const updatedAt = new Date().toISOString();

  const currentMetadata = confirmationResult.data.metadata && typeof confirmationResult.data.metadata === "object"
    ? confirmationResult.data.metadata as Record<string, unknown>
    : {};
  const additionalServices = getConfirmationAdditionalServices(currentMetadata);
  const metadata = serviceLabel
    ? {
        ...currentMetadata,
        additional_services: [...additionalServices, { label: serviceLabel, ...(serviceCost !== undefined ? { cost: serviceCost } : {}) }]
      }
    : undefined;

  await updateConfirmationAmounts(params.id, depositAmount, balanceAmount, newTotalPrice, metadata);

  if (serviceLabel) {
    await trackQuoteEvent(quoteId, "amounts_updated", {
      oldTotal,
      newTotal: newTotalPrice,
      depositAmount,
      balanceAmount,
      serviceLabel,
      serviceCost,
      updatedAt
    });
  }

  const freshQuoteResult = await getQuoteById(quoteId);
  return NextResponse.json({ success: true, quote: freshQuoteResult.data });
}
