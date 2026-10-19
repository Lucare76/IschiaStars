import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { Quote, QuoteHotelOption } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// I prezzi delle opzioni hotel sono sempre per singola camera (vedi "totale camera" nella pagina pubblica):
// qui non vengono mai moltiplicati né associati al numero di ospiti.
export function buildInterestedFollowUpMessage(quote: Quote, hotelName: string, hotelGroup?: number) {
  const price = interestedHotelPriceText(quote, hotelName, hotelGroup);
  const priceLine = price
    ? `La proposta è ancora molto interessante:${price.multiline ? "\n" : " "}${price.text}.`
    : "La proposta è ancora molto interessante.";

  return `Ciao ${quote.customerFirstName} 😊
ho visto che ti interessa l’${hotelName} per il periodo ${shortStayRange(quote.arrivalDate, quote.departureDate)}.
${priceLine}
Vuoi che controllo subito la disponibilità aggiornata e, se è tutto ok, ti spiego come bloccarla?`;
}

export function interestedHotelPriceText(quote: Quote, hotelName: string, hotelGroup?: number): { text: string; multiline: boolean } | null {
  const rooms = interestedHotelOptions(quote, hotelName, hotelGroup)
    .map((option) => ({ label: option.roomTypeLabel?.trim() ?? "", prices: validPrices(option) }))
    .filter((room) => room.prices.length > 0);
  if (!rooms.length) return null;

  const allPrices = rooms.flatMap((room) => room.prices);
  const minPrice = Math.min(...allPrices);

  // Senza hotelOptions il prezzo arriva da totalPrice: con più camere è il totale pratica, non il prezzo camera.
  if (quote.hotelOptions.length === 0 && quote.rooms > 1) {
    return { text: `${formatCurrency(minPrice)} in totale`, multiline: false };
  }

  if (new Set(allPrices).size === 1) return { text: `${formatCurrency(minPrice)} per camera`, multiline: false };

  // Dettaglio per tipologia solo se ricostruibile senza ambiguità: un prezzo per tipologia ed etichette distinte.
  const labels = rooms.map((room) => normalizeText(room.label));
  const canDetail = rooms.length > 1
    && rooms.every((room) => room.label && new Set(room.prices).size === 1)
    && new Set(labels).size === labels.length;
  if (canDetail) {
    return { text: rooms.map((room) => `${room.label} ${formatCurrency(room.prices[0])}`).join(" · "), multiline: true };
  }

  return {
    text: `${formatCurrency(minPrice)} per camera`,
    multiline: false
  };
}

function interestedHotelOptions(quote: Quote, hotelName: string, hotelGroup?: number): QuoteHotelOption[] {
  const normalizedHotel = normalizeText(hotelName);
  const sameHotel = getEffectiveHotelOptions(quote)
    .filter((option) => normalizeText(option.hotelName) === normalizedHotel);
  if (hotelGroup == null) return sameHotel;
  const sameGroup = sameHotel.filter((option) => option.hotelGroup === hotelGroup);
  return sameGroup.length ? sameGroup : sameHotel;
}

function validPrices(option: QuoteHotelOption) {
  return option.treatments
    .map((treatment) => treatment.price)
    .filter((price) => Number.isFinite(price) && price > 0);
}

function shortStayRange(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return `${arrivalDate} - ${departureDate}`;

  const month = (date: Date) => new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(date);
  const day = (date: Date) => new Intl.DateTimeFormat("it-IT", { day: "numeric", timeZone: "Europe/Rome" }).format(date);
  if (month(arrival) !== month(departure)) {
    return `${day(arrival)} ${month(arrival)}–${day(departure)} ${month(departure)}`;
  }
  return `${day(arrival)}-${day(departure)} ${month(departure)}`;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
