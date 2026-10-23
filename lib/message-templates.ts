import { Quote, QuoteHotelOption } from "@/lib/types";
import { getMandatoryHotelFeeNote } from "@/lib/hotel-policies";

type PublicQuoteMessageTarget = {
  code: string;
};

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

function stayIncludesAugust(arrival: string, departure: string): boolean {
  const start = parseDateOnlyUtc(arrival);
  const end = parseDateOnlyUtc(departure);
  if (!start || !end) return false;

  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const augustStart = Date.UTC(year, 7, 1);
    const augustEnd = Date.UTC(year, 7, 31);
    if (start.getTime() <= augustEnd && end.getTime() >= augustStart) return true;
  }
  return false;
}

function parseDateOnlyUtc(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAvailabilityReminderNote(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "ultime disponibilita" || normalized === "disponibilita limitata e su richiesta";
}

function visibleNoteLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((note) => note.trim())
    .filter((note) => note && !isAvailabilityReminderNote(note));
}

function roomCapacityFromLabel(label: string | null | undefined): number | undefined {
  const normalized = (label ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("singola")) return 1;
  if (normalized.includes("tripla")) return 3;
  if (normalized.includes("quadrupla")) return 4;
  if (normalized.includes("doppia") || normalized.includes("matrimoniale")) return 2;
  return undefined;
}

function roomShortName(label: string | null | undefined): string {
  const capacity = roomCapacityFromLabel(label);
  if (capacity === 1) return "singola";
  if (capacity === 2) return "doppia";
  if (capacity === 3) return "tripla";
  if (capacity === 4) return "quadrupla";
  return (label ?? "camera").trim().toLowerCase();
}

function roomShortNamePlural(name: string): string {
  if (name === "singola") return "singole";
  if (name === "doppia") return "doppie";
  if (name === "tripla") return "triple";
  if (name === "quadrupla") return "quadruple";
  return name;
}

function multiRoomSummary(group: QuoteHotelOption[] | undefined, roomCount: number): string | undefined {
  if (!group?.length) return undefined;
  if (group.length === 1 && roomCount > 1) {
    const name = roomShortName(group[0].roomTypeLabel);
    return `${roomCount} ${roomShortNamePlural(name)}`;
  }

  const counts = new Map<string, number>();
  for (const option of group) {
    const name = roomShortName(option.roomTypeLabel);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => `${count} ${count === 1 ? name : roomShortNamePlural(name)}`)
    .join(" · ");
}

function formatMultiRoomPriceScope(label: string | null | undefined): string {
  const capacity = roomCapacityFromLabel(label);
  if (!capacity) return "totale camera";
  return `totale PER ${capacity} PERSON${capacity === 1 ? "A" : "E"}`;
}

function formatGuestTotalLabel(guestCount: number): string {
  if (guestCount === 1) return "totale per una persona";

  const words: Record<number, string> = {
    2: "due",
    3: "tre",
    4: "quattro",
    5: "cinque",
    6: "sei",
    7: "sette",
    8: "otto",
    9: "nove",
    10: "dieci",
    11: "undici",
    12: "dodici",
    13: "tredici",
    14: "quattordici",
    15: "quindici",
    16: "sedici",
    17: "diciassette",
    18: "diciotto",
    19: "diciannove",
    20: "venti"
  };

  return `totale per ${words[guestCount] ?? guestCount} persone`;
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
  const guestCount = quote.adults + childCount;
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
  const proposalTitle = hotelEntries.length > 1
    ? "Le tue proposte personalizzate per Ischia sono pronte 🌊"
    : "La tua proposta personalizzata per Ischia è pronta 🌊";

  const singleRoomCostsHeading = `💰 COSTI TOTALI PER ${guestCount} PERSON${guestCount === 1 ? "A" : "E"}`;
  const multiRoomCostsHeading = "💰 COSTI TOTALI PER OGNI CAMERA";

  const hotelBlocks = hotelEntries.map(group => {
    const first = group[0];
    const starsStr = first.hotelStars && first.hotelStars > 0 ? " " + "⭐".repeat(first.hotelStars) : "";
    const lines: string[] = [`🏨 ${first.hotelName}${starsStr}`];
    const priceScopeLabel = quote.rooms > 1 ? undefined : formatGuestTotalLabel(guestCount);

    if (group.length === 1) {
      const optionLabel = first.roomTypeLabel?.trim();
      if (optionLabel && !roomTypeLine) {
        lines.push(`   🛏 ${optionLabel}`);
      }
      for (const treatment of first.treatments) {
        lines.push(`${optionLabel && !roomTypeLine ? "      " : "   "}· ${treatment.label}: ${formatWAPrice(treatment.price)} ${quote.rooms > 1 ? formatMultiRoomPriceScope(first.roomTypeLabel) : priceScopeLabel}`);
      }
    } else {
      for (let index = 0; index < group.length; index++) {
        const option = group[index];
        const optionLabel = option.roomTypeLabel?.trim() || `Soluzione ${index + 1}`;
        if (index > 0) lines.push("", "");
        lines.push(`   🛏 ${optionLabel}`);
        for (const treatment of option.treatments) {
          lines.push(`      · ${treatment.label}: ${formatWAPrice(treatment.price)} ${quote.rooms > 1 ? formatMultiRoomPriceScope(option.roomTypeLabel) : priceScopeLabel}`);
        }
      }
    }
    const optionNotes = Array.from(new Set(group.flatMap((option) => visibleNoteLines(option.notes))));
    if (optionNotes.length > 0) {
      lines.push("   📝 Note struttura/camera:");
      lines.push(...optionNotes.map((note) => `      · ${note}`));
    }
    const commitmentNote = first.commitmentNote?.trim();
    if (commitmentNote) {
      lines.push(`   ⚠️ *${commitmentNote}*`);
    }
    return lines.join("\n");
  });

  const hotelsBlock = hotelBlocks.join("\n─────────\n");

  const showMandatoryHotelFees = hotelEntries.length <= 1;
  const mandatoryFeeNotes = showMandatoryHotelFees
    ? Array.from(new Set(
        hotelEntries
          .map((group) => getMandatoryHotelFeeNote(group[0].hotelName))
          .filter((note): note is string => Boolean(note))
      ))
    : [];
  const mandatoryFeeBlock = mandatoryFeeNotes.length > 0
    ? `\n⚠️ ${mandatoryFeeNotes.join("\n⚠️ ")}\n`
    : "";
  const customerNotes = visibleNoteLines(quote.customerNotes);
  const customerNotesBlock = customerNotes.length > 0
    ? `\n📝 Note generali preventivo:\n${customerNotes.map((note) => `· ${note}`).join("\n")}\n`
    : "";
  const availabilityNotice = stayIncludesAugust(quote.arrivalDate, quote.departureDate)
    ? "⚠️ Disponibilità limitata e su richiesta. Ti consigliamo di contattarci telefonicamente."
    : "⚠️ Le disponibilità per questo periodo sono limitate. Ti consigliamo di contattarci telefonicamente.";

  const multiRoomTypeSummary = quote.rooms > 1 ? multiRoomSummary(hotelEntries[0], quote.rooms) : undefined;
  const stayLines = [
    `🗒️ ${stayLine}`,
    quote.rooms > 1 ? `👥 ${guestCount} person${guestCount === 1 ? "a" : "e"}` : `👥 ${guestsLine}`,
    ...(quote.rooms > 1
      ? (multiRoomTypeSummary ? [`🛏️ ${multiRoomTypeSummary}`] : [])
      : (roomTypeLine ? [`🛏️ ${roomTypeLine}`] : [])),
  ].join("\n");

  return `👋 Ciao ${quote.customerFirstName}!
${proposalTitle}
${quote.rooms === 1 ? `\n${singleRoomCostsHeading}\n` : `\n${multiRoomCostsHeading}\n`}
${stayLines}

Apri il link per i dettagli ⬇️
${quoteUrl}

${hotelsBlock}
${mandatoryFeeBlock}
${customerNotesBlock}
Dal link puoi vedere tutti i dettagli e confermare direttamente online.

${availabilityNotice}

Per dubbi o richieste:
📞 081 90 54 81
💬 WhatsApp 371 75 90 017
🌐 ischiastars.it

A presto,
Diego - IschiaStars ☀️`;
}

export function publicQuoteInfoWhatsappMessage(quote: PublicQuoteMessageTarget, quoteUrl?: string) {
  return `Ciao IschiaStars, vorrei informazioni sul preventivo ${quote.code}${quoteUrl ? `: ${quoteUrl}` : ""}`;
}

export function publicQuoteConfirmOrInfoWhatsappMessage(quote: PublicQuoteMessageTarget, quoteUrl: string) {
  return `Ciao IschiaStars, vorrei confermare o chiedere info sul preventivo ${quote.code}: ${quoteUrl}`;
}

export function publicQuoteConfirmedWhatsappMessage(quote: PublicQuoteMessageTarget) {
  return `Ciao IschiaStars, ho confermato il preventivo ${quote.code}.`;
}
