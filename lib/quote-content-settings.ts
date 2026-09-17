export const QUOTE_CONTENT_SETTINGS_KEY = "quote_content_settings";

export type QuoteContentSettings = {
  singleHeroTitle: string;
  multipleHeroTitle: string;
  singleHeroIntro: string;
  multipleHeroIntro: string;
  proposalsTitle: string;
  proposalsDescription: string;
  compareOptionsLabel: string;
  backToProposalsLabel: string;
  selectHotelLabel: string;
  selectRoomLabel: string;
  whatsappCtaLabel: string;
  confirmFormTitle: string;
  confirmButtonLabel: string;
  updatedAt?: string;
};

export const defaultQuoteContentSettings: QuoteContentSettings = {
  singleHeroTitle: "La tua proposta di vacanza a Ischia",
  multipleHeroTitle: "Le tue proposte di vacanza a Ischia",
  singleHeroIntro: "abbiamo preparato una proposta personalizzata per il tuo soggiorno.",
  multipleHeroIntro: "abbiamo preparato più proposte per il tuo soggiorno a Ischia. Confronta le opzioni e conferma quella che preferisci.",
  proposalsTitle: "Le proposte selezionate per te",
  proposalsDescription: "Confronta le soluzioni disponibili e conferma l'opzione che preferisci.",
  compareOptionsLabel: "Confronta le opzioni",
  backToProposalsLabel: "Torna alle proposte",
  selectHotelLabel: "Scegli questo hotel",
  selectRoomLabel: "Scegli questa camera",
  whatsappCtaLabel: "Hai domande? Scrivici su WhatsApp",
  confirmFormTitle: "Conferma il preventivo",
  confirmButtonLabel: "Conferma"
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
    compareOptionsLabel: cleanText(raw.compareOptionsLabel, defaultQuoteContentSettings.compareOptionsLabel, 80),
    backToProposalsLabel: cleanText(raw.backToProposalsLabel, defaultQuoteContentSettings.backToProposalsLabel, 80),
    selectHotelLabel: cleanText(raw.selectHotelLabel, defaultQuoteContentSettings.selectHotelLabel, 80),
    selectRoomLabel: cleanText(raw.selectRoomLabel, defaultQuoteContentSettings.selectRoomLabel, 80),
    whatsappCtaLabel: cleanText(raw.whatsappCtaLabel, defaultQuoteContentSettings.whatsappCtaLabel, 100),
    confirmFormTitle: cleanText(raw.confirmFormTitle, defaultQuoteContentSettings.confirmFormTitle, 100),
    confirmButtonLabel: cleanText(raw.confirmButtonLabel, defaultQuoteContentSettings.confirmButtonLabel, 60),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}
