"use client";

import { useMemo, useState } from "react";
import { Quote } from "@/lib/types";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { formatCurrency, normalizeItalianPhone } from "@/lib/utils";

export function InterestedFollowUpWhatsAppButton({ quote, hotelName }: { quote: Quote; hotelName: string }) {
  const [copied, setCopied] = useState(false);
  const message = useMemo(() => buildInterestedFollowUpMessage(quote, hotelName), [quote, hotelName]);
  const chatUrl = `https://wa.me/${normalizeItalianPhone(quote.customerPhone)}`;

  async function handleClick() {
    await navigator.clipboard.writeText(message).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    window.open(chatUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-95"
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? "✓ Messaggio interesse copiato" : "Follow-up interesse WhatsApp"}
    </button>
  );
}

function buildInterestedFollowUpMessage(quote: Quote, hotelName: string) {
  const price = interestedHotelPrice(quote, hotelName);
  const priceLine = price != null
    ? `La proposta è ancora molto interessante: ${formatCurrency(price)} per ${guestLabel(quote)}.`
    : "La proposta è ancora molto interessante.";

  return `Ciao ${quote.customerFirstName} 😊
ho visto che ti interessa l’${hotelName} per il periodo ${shortStayRange(quote.arrivalDate, quote.departureDate)}.
${priceLine}
Vuoi che controllo subito la disponibilità aggiornata e, se è tutto ok, ti spiego come bloccarla?`;
}

function interestedHotelPrice(quote: Quote, hotelName: string) {
  const normalizedHotel = normalizeText(hotelName);
  const prices = getEffectiveHotelOptions(quote)
    .filter((option) => normalizeText(option.hotelName) === normalizedHotel)
    .flatMap((option) => option.treatments.map((treatment) => treatment.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  return prices[0];
}

function guestLabel(quote: Quote) {
  const adults = `${quote.adults} adult${quote.adults === 1 ? "o" : "i"}`;
  const childrenCount = quote.children.length;
  if (!childrenCount) return adults;
  return `${adults} e ${childrenCount} bambin${childrenCount === 1 ? "o" : "i"}`;
}

function shortStayRange(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return `${arrivalDate} - ${departureDate}`;

  const month = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(departure);
  const startDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", timeZone: "Europe/Rome" }).format(arrival);
  const endDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", timeZone: "Europe/Rome" }).format(departure);
  return `${startDay}-${endDay} ${month}`;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
