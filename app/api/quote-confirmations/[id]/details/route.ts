import { NextRequest, NextResponse } from "next/server";
import { getQuoteConfirmationById, updateConfirmationDetails } from "@/lib/repositories/quoteConfirmations";
import { trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getQuoteById, updateQuote } from "@/lib/repositories/quotes";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import type { Quote } from "@/lib/types";

type UpdateConfirmationDetailsBody = {
  firstName?: unknown;
  lastName?: unknown;
  fiscalCode?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
  adults?: unknown;
  children?: unknown;
  roomTypeLabel?: unknown;
  selectedHotelOptionId?: unknown;
  selectedHotelName?: unknown;
  selectedTreatmentKey?: unknown;
  selectedTreatmentLabel?: unknown;
  selectedPrice?: unknown;
  selectedDepositAmount?: unknown;
  selectedBalanceAmount?: unknown;
  selectedBalanceMethod?: unknown;
  selectedPaymentPolicy?: unknown;
  selectedCancellationPolicy?: unknown;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as UpdateConfirmationDetailsBody | null;
  const firstName = stringValue(body?.firstName);
  const lastName = stringValue(body?.lastName);
  const fiscalCode = stringValue(body?.fiscalCode);
  const phone = stringValue(body?.phone);
  const email = stringValue(body?.email).toLowerCase();
  const address = stringValue(body?.address);
  const checkIn = stringValue(body?.checkIn);
  const checkOut = stringValue(body?.checkOut);
  const adults = Number(body?.adults);
  const children = normalizeChildren(body?.children);
  const roomTypeLabel = stringValue(body?.roomTypeLabel);
  const selectedHotelName = stringValue(body?.selectedHotelName);
  const selectedTreatmentLabel = stringValue(body?.selectedTreatmentLabel);
  const selectedBalanceMethod = stringValue(body?.selectedBalanceMethod);
  const selectedPaymentPolicy = stringValue(body?.selectedPaymentPolicy);
  const selectedCancellationPolicy = stringValue(body?.selectedCancellationPolicy);
  const selectedHotelOptionId = optionalString(body?.selectedHotelOptionId);
  const selectedTreatmentKey = optionalString(body?.selectedTreatmentKey);
  const selectedPrice = Number(body?.selectedPrice);
  const selectedDepositAmount = Number(body?.selectedDepositAmount);
  const selectedBalanceAmount = Number(body?.selectedBalanceAmount);

  if (!firstName || !phone || !email) {
    return NextResponse.json({ success: false, error: "Compila nome, telefono ed email" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Indirizzo email non valido" }, { status: 400 });
  }
  if (!isValidDateOnly(checkIn) || !isValidDateOnly(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ success: false, error: "Date soggiorno non valide" }, { status: 400 });
  }
  if (!Number.isInteger(adults) || adults < 1 || adults > 20) {
    return NextResponse.json({ success: false, error: "Numero adulti non valido" }, { status: 400 });
  }
  if (children.some((child) => child.age != null && (!Number.isInteger(child.age) || child.age < 0 || child.age > 17))) {
    return NextResponse.json({ success: false, error: "Età bambini non valida" }, { status: 400 });
  }
  if (!selectedHotelName || !selectedTreatmentLabel || !selectedBalanceMethod) {
    return NextResponse.json({ success: false, error: "Compila hotel, trattamento e modalità saldo" }, { status: 400 });
  }
  if (!Number.isFinite(selectedPrice) || selectedPrice <= 0) {
    return NextResponse.json({ success: false, error: "Prezzo non valido" }, { status: 400 });
  }
  if (!Number.isFinite(selectedDepositAmount) || selectedDepositAmount < 0) {
    return NextResponse.json({ success: false, error: "Caparra non valida" }, { status: 400 });
  }
  if (!Number.isFinite(selectedBalanceAmount) || selectedBalanceAmount < 0) {
    return NextResponse.json({ success: false, error: "Saldo non valido" }, { status: 400 });
  }
  if (Math.abs((selectedDepositAmount + selectedBalanceAmount) - selectedPrice) > 0.01) {
    return NextResponse.json({ success: false, error: "Prezzo, caparra e saldo non tornano" }, { status: 400 });
  }

  const confirmationResult = await getQuoteConfirmationById(params.id);
  if (!confirmationResult.data) {
    return NextResponse.json({ success: false, error: "Conferma non trovata" }, { status: 404 });
  }

  const quoteId = String(confirmationResult.data.quote_id);
  const quoteResult = await getQuoteById(quoteId);
  if (!quoteResult.data) {
    return NextResponse.json({ success: false, error: "Preventivo non trovato" }, { status: 404 });
  }
  const currentMetadata = confirmationResult.data.metadata && typeof confirmationResult.data.metadata === "object"
    ? confirmationResult.data.metadata as Record<string, unknown>
    : {};
  const selectedDepositPercent = selectedPrice > 0
    ? Math.round((selectedDepositAmount / selectedPrice) * 10000) / 100
    : null;
  const finalTreatmentLabel = stripRoomTypeFromTreatment(selectedTreatmentLabel, roomTypeLabel);
  const metadata = {
    ...currentMetadata,
    children: mergeConfirmationChildren(currentMetadata.children, children),
    selected_rooms: buildSelectedRooms({
      quote: quoteResult.data,
      selectedHotelOptionId,
      selectedHotelName,
      selectedTreatmentKey,
      selectedTreatmentLabel: finalTreatmentLabel,
      roomTypeLabel,
      selectedPrice,
      selectedDepositAmount,
      selectedBalanceAmount
    }),
    manual_admin_edit: {
      updated_at: new Date().toISOString(),
      selected_hotel_option_id: selectedHotelOptionId,
      selected_treatment_key: selectedTreatmentKey,
      adults,
      children_count: children.length,
      room_type_label: roomTypeLabel
    }
  };

  const updateResult = await updateConfirmationDetails(params.id, {
    firstName,
    lastName,
    fiscalCode,
    phone,
    email,
    address,
    selectedHotelOptionId,
    selectedHotelName,
    selectedTreatmentKey,
    selectedTreatmentLabel: finalTreatmentLabel,
    selectedPrice,
    selectedDepositPercent,
    selectedDepositAmount,
    selectedBalanceAmount,
    selectedBalanceMethod,
    selectedPaymentPolicy,
    selectedCancellationPolicy,
    metadata
  });
  if (!updateResult.data) {
    return NextResponse.json({ success: false, error: updateResult.error ?? "Riepilogo non aggiornato" }, { status: 500 });
  }

  const quoteUpdate = await updateQuote(quoteId, {
    clientFirstName: firstName,
    clientLastName: lastName,
    clientEmail: email,
    clientPhone: phone,
    checkIn,
    checkOut,
    adults,
    children,
    totalPrice: selectedPrice,
    depositAmount: selectedDepositAmount
  });
  if (!quoteUpdate.data) {
    return NextResponse.json({ success: false, error: quoteUpdate.error ?? "Preventivo non sincronizzato" }, { status: 500 });
  }

  await trackQuoteEvent(quoteId, "amounts_updated", {
    source: "confirmation_details_edit",
    selectedHotelName,
    selectedTreatmentLabel: finalTreatmentLabel,
    roomTypeLabel,
    adults,
    childrenCount: children.length,
    checkIn,
    checkOut,
    selectedPrice,
    selectedDepositAmount,
    selectedBalanceAmount
  });

  const freshQuoteResult = await getQuoteById(quoteId);
  return NextResponse.json({ success: true, quote: freshQuoteResult.data });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  const normalized = stringValue(value);
  return normalized || null;
}

function normalizeChildren(value: unknown): { birthDate?: string; age?: number }[] {
  if (!Array.isArray(value)) return [];
  return value.map((child) => {
    if (!child || typeof child !== "object") return {};
    const record = child as Record<string, unknown>;
    const birthDate = stringValue(record.birthDate);
    const rawAge = record.age === "" || record.age == null ? undefined : Number(record.age);
    return {
      ...(birthDate ? { birthDate } : {}),
      ...(rawAge !== undefined && Number.isFinite(rawAge) ? { age: rawAge } : {})
    };
  });
}

function mergeConfirmationChildren(currentValue: unknown, children: { birthDate?: string; age?: number }[]) {
  const currentChildren = Array.isArray(currentValue) ? currentValue : [];
  return children.map((child, index) => {
    const current = currentChildren[index];
    const currentRecord = current && typeof current === "object" ? current as Record<string, unknown> : {};
    const currentBirthDate = typeof currentRecord.birthDate === "string" ? currentRecord.birthDate : "";
    return {
      ...currentRecord,
      ...(child.birthDate || currentBirthDate ? { birthDate: child.birthDate || currentBirthDate } : {}),
      ...(child.age != null ? { age: child.age } : {})
    };
  });
}

function buildSelectedRooms(input: {
  quote: Quote;
  selectedHotelOptionId: string | null;
  selectedHotelName: string;
  selectedTreatmentKey: string | null;
  selectedTreatmentLabel: string;
  roomTypeLabel: string;
  selectedPrice: number;
  selectedDepositAmount: number;
  selectedBalanceAmount: number;
}) {
  const selectedOption = input.selectedHotelOptionId
    ? input.quote.hotelOptions.find((option) => option.id === input.selectedHotelOptionId)
    : undefined;
  const optionTreatment = selectedOption?.treatments.find((treatment) => treatment.key === input.selectedTreatmentKey);
  const roomTypeLabel = input.roomTypeLabel || selectedOption?.roomTypeLabel || "Camera standard";
  const treatmentLabel = optionTreatment?.label ?? stripRoomTypeFromTreatment(input.selectedTreatmentLabel, roomTypeLabel);

  return [{
    roomNumber: 1,
    optionId: input.selectedHotelOptionId ?? selectedOption?.id,
    hotelGroup: selectedOption?.hotelGroup ?? 1,
    hotelName: input.selectedHotelName,
    roomTypeLabel,
    treatmentKey: input.selectedTreatmentKey ?? optionTreatment?.key,
    treatmentLabel,
    price: input.selectedPrice,
    depositAmount: input.selectedDepositAmount,
    balanceAmount: input.selectedBalanceAmount
  }];
}

function stripRoomTypeFromTreatment(treatmentLabel: string, roomTypeLabel: string) {
  const normalized = treatmentLabel.toLowerCase();
  const normalizedRoom = roomTypeLabel.toLowerCase();
  if (normalized.startsWith(`${normalizedRoom}, `)) return treatmentLabel.slice(roomTypeLabel.length + 2).trim();
  if (normalized.startsWith(`${normalizedRoom} - `)) return treatmentLabel.slice(roomTypeLabel.length + 3).trim();
  return treatmentLabel;
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
