import {
  CANCELLATION_POLICY_7_DAYS,
  CANCELLATION_POLICY_14_DAYS,
  CANCELLATION_POLICY_20_DAYS,
} from "@/lib/hotel-policies";
import type { Quote } from "@/lib/types";

export type QuoteLanguage = "it" | "en";
export type EnglishTranslations = Record<string, string>;
export function quoteLanguage(value: unknown): QuoteLanguage {
  return value === "en" ? "en" : "it";
}
export function normalizeTranslations(value: unknown): EnglishTranslations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, text]) =>
          key.length <= 12000 &&
          typeof text === "string" &&
          text.trim().length > 0 &&
          text.length <= 18000,
      )
      .slice(0, 500)
      .map(([key, text]) => [key, (text as string).trim()]),
  );
}
export function requestLanguage(metadata: unknown): QuoteLanguage {
  const m =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : {};
  const explicit = m.language ?? m.lang ?? m.locale;
  if (typeof explicit === "string" && /^en(?:[-_]|$)/i.test(explicit))
    return "en";
  if (explicit === "it") return "it";
  const url = String(m.source_url ?? m.page_url ?? "");
  return /\/en(?:[\/#?]|$)|[?&](?:lang|language)=en(?:&|$)/i.test(url)
    ? "en"
    : "it";
}
const phrases: Record<string, string> = {
  "Inviare copia del pagamento tramite email o WhatsApp.": "Please send a copy of the payment confirmation by email or WhatsApp.",
  "Camera e colazione": "Bed and breakfast",
  "Mezza pensione": "Half board",
  "Pensione completa": "Full board",
  "Colazione inclusa": "Breakfast included",
  "Mezza pensione inclusa": "Half board included",
  "Pensione completa inclusa": "Full board included",
  "Camera standard": "Standard room",
  "Camera singola standard": "Standard single room",
  "Camera matrimoniale standard": "Standard double room",
  "Camera matrimoniale con balcone": "Double room with balcony",
  "Camera tripla standard": "Standard triple room",
  "Camera tripla con balcone": "Triple room with balcony",
  "Camera quadrupla standard": "Standard quadruple room",
  "Camera quadrupla con balcone": "Quadruple room with balcony",
  "Camera quintupla standard": "Standard room for five guests",
  "Ultime disponibilità": "Limited availability",
  "Ultime disponibilità con queste tariffe":
    "Limited availability at these rates",
  "Cenone di San Silvestro incluso": "New Year's Eve gala dinner included",
  "Bevande incluse ( acqua e vino )": "Drinks included (water and wine)",
  "Bevande incluse ai pasti": "Drinks included with meals",
  "Bevande escluse": "Drinks not included",
  "Acqua ai pasti inclusa": "Water included with meals",
  "Prima colazione a buffet": "Buffet breakfast",
  "Parcheggio incluso": "Parking included",
  "Transfer incluso": "Transfer included",
  "Accesso spa/terme incluso": "Spa/thermal pool access included",
  "Spiaggia convenzionata inclusa": "Partner beach access included",
  "Extra esclusi salvo diversa indicazione":
    "Extras excluded unless otherwise stated",
  "Costi intesi per ogni camera": "Prices are per room",
  "SOGGIORNO MINIMO 3 NOTTI": "MINIMUM STAY: 3 NIGHTS",
  "OFFERTA PRENOTA PRIMA": "EARLY BOOKING OFFER",
  "Struttura centrale, facile da raggiungere":
    "Central location, easy to reach",
  "Ottimo rapporto qualità/prezzo": "Excellent value for money",
  "Ideale per famiglie con bambini": "Ideal for families with children",
  "Vista mare garantita": "Guaranteed sea view",
  "Struttura tranquilla, lontana dal caos":
    "A peaceful setting away from the crowds",
  "Consigliato per coppie": "Recommended for couples",
  "Uno dei più richiesti della stagione":
    "One of our most popular hotels this season",
  "Trattamento termale incluso": "Thermal treatment included",
  "Tariffa riservata ai clienti con impegnativa per fanghi e bagni termali":
    "Rate reserved for guests with an Italian NHS prescription for mud and thermal bath treatments",
  "Saldo in struttura con carta o contanti.":
    "Balance payable at the hotel by card or cash.",
  "Saldo entro 14 giorni dall’arrivo tramite bonifico bancario.":
    "Balance payable by bank transfer no later than 14 days before arrival.",
  "Saldo entro 14 giorni dall'arrivo tramite bonifico bancario.":
    "Balance payable by bank transfer no later than 14 days before arrival.",
  "Saldo restante in struttura con carta o contanti.":
    "Remaining balance payable at the hotel by card or cash.",
};
export function translateQuoteText(
  text: string | null | undefined,
  translations: EnglishTranslations = {},
): string | undefined {
  if (!text?.trim()) return "";
  const source = text.trim();
  if (Object.prototype.hasOwnProperty.call(translations, source))
    return translations[source];
  if (Object.prototype.hasOwnProperty.call(phrases, source))
    return phrases[source];
  const deposit = source.match(
    /^Acconto (\d+(?:[.,]\d+)?)% alla conferma\. Saldo restante in struttura con carta o contanti\.$/,
  );
  if (deposit)
    return `A ${deposit[1]}% deposit is payable on confirmation. The remaining balance is payable at the hotel by card or cash.`;
  const bankDeposit = source.match(
    /^Acconto del (\d+(?:[.,]\d+)?)% e saldo entro 14 giorni dall'arrivo tramite bonifico bancario\.$/,
  );
  if (bankDeposit)
    return `A ${bankDeposit[1]}% deposit is required. The remaining balance must be paid by bank transfer no later than 14 days before arrival.`;
  if (
    source ===
    "Saldo da effettuare tramite bonifico bancario entro 14 giorni dalla data di arrivo."
  )
    return "The balance must be paid by bank transfer no later than 14 days before arrival.";
  const policies = [
    CANCELLATION_POLICY_7_DAYS,
    CANCELLATION_POLICY_14_DAYS,
    CANCELLATION_POLICY_20_DAYS,
  ];
  const policyIndex = policies.indexOf(source);
  if (policyIndex >= 0) {
    const days = [7, 14, 20][policyIndex];
    return `You may cancel or amend your booking without penalty up to ${days} days before arrival. Any deposit paid will remain valid as a credit to be used within 12 months. After this deadline, or in the event of a no-show, a penalty of 100% of the total booking amount will apply. In the event of late arrival, early departure or a reduction in the number of guests, the full booking amount remains due${policyIndex === 2 ? ", with no reductions for changes in the length of stay or number of guests" : ""}. Unused meals are not refundable.`;
  }
  if (source.includes("\n")) {
    const lines = source
      .split("\n")
      .map((line) => translateQuoteText(line, translations));
    if (lines.every((line) => line !== undefined)) return lines.join("\n");
  }
  return undefined;
}
const optionFields = [
  "hotelReason",
  "roomTypeLabel",
  "breakfastDetails",
  "halfBoardDetails",
  "fullBoardDetails",
  "includedServices",
  "balanceMethod",
  "paymentPolicy",
  "cancellationPolicy",
  "paymentNotes",
  "notes",
  "commitmentNote",
] as const;
export function quoteEnglishSources(quote: Quote): string[] {
  const texts: Array<string | null | undefined> = [
    quote.customerNotes,
    quote.paymentPolicy,
    quote.cancellationPolicy,
    ...quote.servicesIncluded,
  ];
  for (const option of quote.hotelOptions) {
    texts.push(...optionFields.map((key) => option[key]));
    for (const treatment of option.treatments) texts.push(treatment.label);
  }
  const c = quote.confirmation;
  if (c) {
    texts.push(
      c.selectedBalanceMethod,
      c.selectedPaymentPolicy,
      c.selectedCancellationPolicy,
      c.voucherNotes,
      c.finalConfirmationNotes,
      typeof c.paymentSettingsSnapshot?.payment_instructions === "string"
        ? c.paymentSettingsSnapshot.payment_instructions
        : undefined,
    );
    const services = c.metadata?.additional_services;
    if (Array.isArray(services))
      for (const service of services)
        if (typeof service?.label === "string") texts.push(service.label);
  }
  return Array.from(
    new Set(texts.flatMap((text) => (text?.trim() ? [text.trim()] : []))),
  );
}
export function missingEnglishTranslations(quote: Quote): string[] {
  return quoteEnglishSources(quote).filter(
    (text) => translateQuoteText(text, quote.englishTranslations) === undefined,
  );
}
export function requireEnglishText(
  quote: Pick<Quote, "englishTranslations">,
  text?: string | null,
): string {
  const translated = translateQuoteText(text, quote.englishTranslations);
  if (translated === undefined)
    throw new Error(
      "Completa la traduzione inglese prima di inviare il preventivo: " +
        text?.slice(0, 100),
    );
  return translated;
}
export function englishDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
export function englishMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
