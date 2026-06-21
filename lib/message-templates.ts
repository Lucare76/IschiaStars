import { Quote, QuoteHotelOption } from "@/lib/types";

function formatWAPrice(price: number): string {
  const rounded = Math.round(price);
  if (Math.abs(price - rounded) < 0.005) {
    return `€${new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded)}`;
  }
  return `€${new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)}`;
}

function nightsCount(arrival: string, departure: string): number {
  return Math.round((new Date(departure).getTime() - new Date(arrival).getTime()) / (1000 * 60 * 60 * 24));
}

function formatWADateRange(arrival: string, departure: string): string {
  const ROME = "Europe/Rome";
  const start = new Date(arrival);
  const end = new Date(departure);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: ROME, ...opts }).format(date);
  const startLabel = `${fmt(start, { day: "numeric" })} ${cap(fmt(start, { month: "long" }))}`;
  const endLabel = `${fmt(end, { day: "numeric" })} ${cap(fmt(end, { month: "long" }))} ${fmt(end, { year: "numeric" })}`;
  const nights = nightsCount(arrival, departure);
  return `${startLabel} → ${endLabel} · ${nights} nott${nights === 1 ? "e" : "i"}`;
}

export function adminQuoteWhatsappMessage(input: {
  quote: Quote;
  options: QuoteHotelOption[];
  quoteUrl: string;
}) {
  const { quote, options, quoteUrl } = input;

  const stayLine = formatWADateRange(quote.arrivalDate, quote.departureDate);

  const adultsLabel = `${quote.adults} adult${quote.adults === 1 ? "o" : "i"}`;
  const childCount = quote.children.length;
  const guestsLine = childCount > 0
    ? `${adultsLabel}, ${childCount} bambin${childCount === 1 ? "o" : "i"}`
    : adultsLabel;

  const firstRoomType = options[0]?.roomTypeLabel?.trim();
  const allSameRoomType = firstRoomType
    ? options.every(o => (o.roomTypeLabel?.trim() || "") === firstRoomType)
    : false;
  const roomTypeLine = allSameRoomType ? firstRoomType : undefined;

  // Group options by hotelGroup
  const groups = new Map<number, QuoteHotelOption[]>();
  for (const opt of options) {
    if (!groups.has(opt.hotelGroup)) groups.set(opt.hotelGroup, []);
    groups.get(opt.hotelGroup)!.push(opt);
  }

  const hotelEntries = Array.from(groups.values());

  const hotelBlocks = hotelEntries.map(group => {
    const first = group[0];
    const starsStr = first.hotelStars && first.hotelStars > 0 ? " " + "⭐".repeat(first.hotelStars) : "";
    const lines: string[] = [`🏨 ${first.hotelName}${starsStr}`];

    if (group.length === 1) {
      const optionLabel = first.roomTypeLabel?.trim();
      if (optionLabel && !roomTypeLine) {
        lines.push(`   🛏 ${optionLabel}`);
      }
      for (const treatment of first.treatments) {
        lines.push(`${optionLabel && !roomTypeLine ? "      " : "   "}· ${treatment.label}: ${formatWAPrice(treatment.price)}`);
      }
    } else {
      for (let index = 0; index < group.length; index++) {
        const option = group[index];
        const optionLabel = option.roomTypeLabel?.trim() || `Soluzione ${index + 1}`;
        lines.push(`   🛏 ${optionLabel}`);
        for (const treatment of option.treatments) {
          lines.push(`      · ${treatment.label}: ${formatWAPrice(treatment.price)}`);
        }
      }
    }
    return lines.join("\n");
  });

  const hotelsBlock = hotelBlocks.join("\n─────────\n");

  const stayLines = [
    `🗒 ${stayLine}`,
    `👥 ${guestsLine}`,
    ...(roomTypeLine ? [`🛏 ${roomTypeLine}`] : []),
  ].join("\n");

  return `👋 Ciao ${quote.customerFirstName}!
La tua proposta personalizzata per Ischia è pronta 🌊

${stayLines}

${hotelsBlock}

Ecco il tuo preventivo personalizzato:

${quoteUrl}

Dal link puoi vedere tutti i dettagli e confermare direttamente online.
Se il link non si apre, tienilo premuto e scegli “Apri il link”.

⚠️ Le disponibilità per questo periodo sono limitate. Ti consigliamo di confermare appena possibile.

Per dubbi o richieste:
📞 081 90 54 81
💬 WhatsApp 371 75 90 017

A presto,
Diego - IschiaStars ☀️`;
}

export function publicQuoteInfoWhatsappMessage(quote: Quote, quoteUrl?: string) {
  return `Ciao IschiaStars, vorrei informazioni sul preventivo ${quote.code}${quoteUrl ? `: ${quoteUrl}` : ""}`;
}

export function publicQuoteConfirmOrInfoWhatsappMessage(quote: Quote, quoteUrl: string) {
  return `Ciao IschiaStars, vorrei confermare o chiedere info sul preventivo ${quote.code}: ${quoteUrl}`;
}

export function publicQuoteConfirmedWhatsappMessage(quote: Quote) {
  return `Ciao IschiaStars, ho confermato il preventivo ${quote.code}.`;
}
