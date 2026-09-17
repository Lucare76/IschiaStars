export const QUOTE_CONTENT_SETTINGS_KEY = "quote_content_settings";

export type QuoteContentSettings = {
  singleHeroTitle: string;
  multipleHeroTitle: string;
  singleHeroIntro: string;
  multipleHeroIntro: string;
  proposalsTitle: string;
  proposalsDescription: string;
  whatsappCta: string;
  compareCta: string;
  compareBackCta: string;
  chooseHotelCta: string;
  noOnlinePaymentNote: string;
  updatedAt?: string;
};

export const defaultQuoteContentSettings: QuoteContentSettings = {
  singleHeroTitle: "La tua proposta di vacanza a Ischia",
  multipleHeroTitle: "Le tue proposte di vacanza a Ischia",
  singleHeroIntro: "abbiamo preparato una proposta personalizzata per il tuo soggiorno.",
  multipleHeroIntro: "abbiamo preparato più proposte per il tuo soggiorno a Ischia. Confronta le opzioni e conferma quella che preferisci.",
  proposalsTitle: "Le proposte selezionate per te",
  proposalsDescription: "Confronta le soluzioni disponibili e conferma l'opzione che preferisci.",
  whatsappCta: "Hai domande? Scrivici su WhatsApp",
  compareCta: "Confronta le opzioni",
  compareBackCta: "Torna alle proposte",
  chooseHotelCta: "Scegli questo hotel",
  noOnlinePaymentNote: "Nessun pagamento online — ti ricontattiamo per finalizzare"
};

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

export function normalizeQuoteContentSettings(value: unknown): QuoteContentSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    singleHeroTitle: cleanText(raw.singleHeroTitle, defaultQuoteContentSettings.singleHeroTitle, 140),
    multipleHeroTitle: cleanText(raw.multipleHeroTitle, defaultQuoteContentSettings.multipleHeroTitle, 140),
    singleHeroIntro: cleanText(raw.singleHeroIntro, defaultQuoteContentSettings.singleHeroIntro, 500),
    multipleHeroIntro: cleanText(raw.multipleHeroIntro, defaultQuoteContentSettings.multipleHeroIntro, 500),
    proposalsTitle: cleanText(raw.proposalsTitle, defaultQuoteContentSettings.proposalsTitle, 140),
    proposalsDescription: cleanText(raw.proposalsDescription, defaultQuoteContentSettings.proposalsDescription, 500),
    whatsappCta: cleanText(raw.whatsappCta, defaultQuoteContentSettings.whatsappCta, 120),
    compareCta: cleanText(raw.compareCta, defaultQuoteContentSettings.compareCta, 120),
    compareBackCta: cleanText(raw.compareBackCta, defaultQuoteContentSettings.compareBackCta, 120),
    chooseHotelCta: cleanText(raw.chooseHotelCta, defaultQuoteContentSettings.chooseHotelCta, 120),
    noOnlinePaymentNote: cleanText(raw.noOnlinePaymentNote, defaultQuoteContentSettings.noOnlinePaymentNote, 220),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}
