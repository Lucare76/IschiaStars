import { NextRequest, NextResponse } from "next/server";
import { generateVoucherPdf } from "@/lib/pdf/generateVoucher";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { formatCurrency, formatDate, formatDateTime, ischiastarsWhatsappNumber } from "@/lib/utils";

type ManualVoucherBody = {
  quoteCode?: unknown;
  clientFullName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  hotelName?: unknown;
  roomTypeLabel?: unknown;
  treatmentLabel?: unknown;
  arrivalDate?: unknown;
  departureDate?: unknown;
  adults?: unknown;
  children?: unknown;
  includedServices?: unknown;
  depositAmount?: unknown;
  depositPaidAt?: unknown;
  balanceAmount?: unknown;
  balanceMethodLabel?: unknown;
  cancellationPolicy?: unknown;
  voucherNotes?: unknown;
};

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as ManualVoucherBody | null;
  if (!body) return NextResponse.json({ ok: false, error: "Dati voucher non validi" }, { status: 400 });

  const clientFullName = cleanString(body.clientFullName);
  const hotelName = cleanString(body.hotelName);
  const arrivalDate = cleanString(body.arrivalDate);
  const departureDate = cleanString(body.departureDate);

  if (!clientFullName) return NextResponse.json({ ok: false, error: "Inserisci il nome del cliente" }, { status: 400 });
  if (!hotelName) return NextResponse.json({ ok: false, error: "Inserisci il nome dell'hotel" }, { status: 400 });
  if (!isValidDate(arrivalDate) || !isValidDate(departureDate)) {
    return NextResponse.json({ ok: false, error: "Inserisci date di arrivo e partenza valide" }, { status: 400 });
  }

  const nightsCount = calculateNights(arrivalDate, departureDate);
  if (!nightsCount) {
    return NextResponse.json({ ok: false, error: "La data di partenza deve essere successiva all'arrivo" }, { status: 400 });
  }

  const quoteCode = cleanString(body.quoteCode) || manualVoucherCode();
  const adults = parseWholeNumber(body.adults);
  const children = parseWholeNumber(body.children);
  const depositAmount = parseAmount(body.depositAmount);
  const balanceAmount = parseAmount(body.balanceAmount);
  const depositPaidAt = cleanString(body.depositPaidAt);
  const services = splitLines(body.includedServices).slice(0, 18);

  const guestsParts: string[] = [];
  if (adults) guestsParts.push(`${adults} ${adults === 1 ? "adulto" : "adulti"}`);
  if (children) guestsParts.push(`${children} ${children === 1 ? "bambino" : "bambini"}`);

  const pdfBuffer = await generateVoucherPdf({
    quoteCode,
    clientFullName,
    clientEmail: cleanString(body.clientEmail),
    clientPhone: cleanString(body.clientPhone),
    hotelName,
    roomTypeLabel: cleanString(body.roomTypeLabel),
    treatmentLabel: cleanString(body.treatmentLabel),
    arrivalDate: formatDate(arrivalDate),
    departureDate: formatDate(departureDate),
    nightsCount,
    guestsLabel: guestsParts.length ? guestsParts.join(", ") : undefined,
    includedServices: services,
    depositAmountLabel: depositAmount != null ? formatCurrency(depositAmount) : "Da verificare",
    depositPaidAtLabel: isValidDate(depositPaidAt) ? formatDateTime(depositPaidAt) : formatDateTime(new Date().toISOString()),
    balanceAmountLabel: balanceAmount != null ? formatCurrency(balanceAmount) : undefined,
    balanceMethodLabel: cleanString(body.balanceMethodLabel),
    cancellationPolicy: cleanString(body.cancellationPolicy),
    voucherNotes: cleanString(body.voucherNotes),
    whatsappNumber: ischiastarsWhatsappNumber(),
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="voucher-${safeFilename(quoteCode)}.pdf"`,
    },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1000) : "";
}

function splitLines(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseWholeNumber(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isValidDate(value: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
}

function calculateNights(arrivalDate: string, departureDate: string) {
  const nights = Math.round((new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / 86400000);
  return nights > 0 ? nights : undefined;
}

function manualVoucherCode() {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 12);
  return `MAN-${stamp}`;
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "manuale";
}
