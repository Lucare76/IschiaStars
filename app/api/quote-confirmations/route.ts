import { NextRequest, NextResponse } from "next/server";
import { BALANCE_METHOD_IN_STRUCTURE, calculatePaymentBreakdown } from "@/lib/hotel-policies";
import { createQuoteConfirmation } from "@/lib/repositories/quoteConfirmations";
import { getQuoteByCodeAndToken } from "@/lib/repositories/quotes";
import { sendQuoteConfirmedInternalEmail } from "@/lib/server/brevo";
import { compareDeclaredAge } from "@/lib/age-utils";
import type { ChildGuest, QuoteRoomSelection } from "@/lib/types";

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
  selectedRooms?: Pick<QuoteRoomSelection, "optionId" | "treatmentKey">[];
};

const INVALID_SELECTION_MESSAGE = "Impossibile completare la conferma. Contattaci su WhatsApp.";

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

  let selection: ReturnType<typeof resolveSelection>;
  try {
    selection = resolveSelection(quoteResult.data, body!);
  } catch (error) {
    console.error("[confirmation] invalid commercial selection", {
      code: quoteResult.data.code,
      selectedRooms: body!.selectedRooms,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: INVALID_SELECTION_MESSAGE }, { status: 400 });
  }
  const ageComparison = buildChildrenAgeComparison(quoteResult.data.children, body!.children ?? [], quoteResult.data.arrivalDate);
  const hasAgeMismatch = ageComparison.some((c) => c.ageMismatch);

  const result = await createQuoteConfirmation(quoteResult.data.id, {
    firstName: body!.firstName!.trim(),
    lastName: body!.lastName!.trim(),
    fiscalCode: (body!.fiscalCode ?? "").trim(),
    phone: body!.phone!.trim(),
    email: body!.email!.trim(),
    address: (body!.address ?? "").trim(),
    city: (body!.city ?? "").trim(),
    postalCode: (body!.postalCode ?? "").trim(),
    province: (body!.province ?? "").trim(),
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
    metadata: {
      children: body!.children ?? [],
      children_age_comparison: ageComparison,
      has_age_mismatch: hasAgeMismatch,
      selected_rooms: selection.selectedRooms,
      source: "public_quote_page"
    }
  });

  if (!result.data) return NextResponse.json({ ok: false, error: result.error ?? "Conferma non salvata" }, { status: 500 });
  console.info(`[confirmation] saved quote=${quoteResult.data.id} code=${quoteResult.data.code}`);

  try {
    await sendQuoteConfirmedInternalEmail(quoteResult.data, {
      firstName: body!.firstName!.trim(),
      lastName: body!.lastName!.trim(),
      fiscalCode: (body!.fiscalCode ?? "").trim(),
      phone: body!.phone!.trim(),
      email: body!.email!.trim(),
      address: (body!.address ?? "").trim(),
      city: (body!.city ?? "").trim(),
      postalCode: (body!.postalCode ?? "").trim(),
      province: (body!.province ?? "").trim(),
      confirmedAt: result.data.confirmedAt,
      children: ageComparison.map((c) => ({
        id: (body!.children ?? [])[c.childIndex - 1]?.id,
        birthDate: c.birthDate,
        declaredAge: c.declaredAge,
        calculatedAge: c.calculatedAge,
        ageMismatch: c.ageMismatch
      })),
      selectedHotelName: selection.selectedHotelName,
      selectedTreatmentLabel: selection.selectedTreatmentLabel,
      selectedPrice: selection.selectedPrice,
      selectedDepositPercent: selection.selectedDepositPercent,
      selectedDepositAmount: selection.selectedDepositAmount,
      selectedBalanceAmount: selection.selectedBalanceAmount,
      selectedBalanceMethod: selection.selectedBalanceMethod,
      selectedPaymentPolicy: selection.selectedPaymentPolicy,
      selectedCancellationPolicy: selection.selectedCancellationPolicy
    });
  } catch (err) {
    console.warn("POST /api/quote-confirmations brevo error", { code: quoteResult.data.code, message: err instanceof Error ? err.message : String(err) });
  }

  return NextResponse.json({ ok: true, source: result.source, confirmedAt: result.data.confirmedAt });
}

function validateConfirmation(body: ConfirmationPayload | null) {
  if (!body?.quoteCode || !body.token) return "Link preventivo non valido";
  const required = [body.firstName, body.lastName, body.phone, body.email];
  if (required.some((v) => !v?.trim())) return "Compila tutti i campi obbligatori";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email!.trim())) return "Email non valida";
  if (body.fiscalCode?.trim() && body.fiscalCode.trim().length < 11) return "Codice fiscale troppo breve";
  if (body.postalCode?.trim() && !/^\d{5}$/.test(body.postalCode.trim())) return "CAP non valido";
  if (!body.acceptedTerms || !body.acceptedPrivacy) return "Accetta condizioni e privacy";
  return null;
}

function buildChildrenAgeComparison(
  quoteChildren: ChildGuest[],
  bodyChildren: { id?: string; birthDate?: string }[],
  checkInDate: string
) {
  return bodyChildren.map((bodyChild, index) => {
    const quoteChild = quoteChildren.find((c) => c.id === bodyChild.id) ?? quoteChildren[index];
    const declaredAge = quoteChild?.age;
    const birthDate = bodyChild.birthDate ?? "";
    if (declaredAge == null || !birthDate) {
      return { childIndex: index + 1, noData: true, ageMismatch: false };
    }
    const result = compareDeclaredAge({ declaredAge, birthDate, checkInDate });
    return {
      childIndex: index + 1,
      declaredAge: result.declaredAge,
      birthDate,
      calculatedAge: result.calculatedAge,
      ageMismatch: !result.matches,
      difference: result.difference,
      noData: false
    };
  });
}

function resolveSelection(quote: NonNullable<Awaited<ReturnType<typeof getQuoteByCodeAndToken>>["data"]>, body: ConfirmationPayload) {
  if (!body.selectedRooms || body.selectedRooms.length !== quote.rooms) throw new Error("Seleziona tutte le camere");
  const selectedRooms = body.selectedRooms.map((room, index) => {
    const option = quote.hotelOptions.find((item) => item.id === room.optionId);
    if (!option) throw new Error("Opzione hotel non valida per questo preventivo");
    const treatment = option.treatments.find((item) => item.key === room.treatmentKey);
    if (!treatment || treatment.price <= 0) throw new Error("Trattamento non disponibile per questa opzione");
    const breakdown = calculatePaymentBreakdown(treatment.price, option.depositPercent, option.balanceMethod || BALANCE_METHOD_IN_STRUCTURE);
    return {
      roomNumber: index + 1,
      optionId: option.id,
      hotelGroup: option.hotelGroup ?? 1,
      hotelName: option.hotelName,
      roomTypeLabel: option.roomTypeLabel || "Camera standard",
      treatmentKey: treatment.key,
      treatmentLabel: treatment.label,
      price: treatment.price,
      depositAmount: breakdown.depositAmount,
      balanceAmount: breakdown.balanceAmount
    };
  });
  if (new Set(selectedRooms.map((room) => room.hotelGroup)).size !== 1) throw new Error("Le camere devono appartenere allo stesso hotel");
  const option = quote.hotelOptions.find((item) => item.id === selectedRooms[0].optionId)!;
  const selectedPrice = selectedRooms.reduce((sum, room) => sum + room.price, 0);
  const selectedDepositAmount = selectedRooms.reduce((sum, room) => sum + room.depositAmount, 0);
  const selectedBalanceAmount = selectedRooms.reduce((sum, room) => sum + room.balanceAmount, 0);
  const compositionLabel = selectedRooms.map((room) => `Camera ${room.roomNumber}: ${room.roomTypeLabel}, ${room.treatmentLabel}`).join("; ");

  return {
    selectedHotelOptionId: option.id,
    selectedHotelName: option.hotelName,
    selectedTreatmentKey: quote.rooms === 1 ? selectedRooms[0].treatmentKey : "room_composition",
    selectedTreatmentLabel: compositionLabel,
    selectedPrice,
    selectedDepositPercent: selectedPrice > 0 ? Math.round((selectedDepositAmount / selectedPrice) * 10000) / 100 : 0,
    selectedDepositAmount,
    selectedBalanceAmount,
    selectedBalanceMethod: option.balanceMethod || BALANCE_METHOD_IN_STRUCTURE,
    selectedPaymentPolicy: option.paymentPolicy,
    selectedCancellationPolicy: option.cancellationPolicy,
    selectedRooms
  };
}
