export const QUOTE_CONTENT_SETTINGS_KEY = "quote_content_settings";

export type QuoteContentSettings = {
  singleHeroTitle: string;
  multipleHeroTitle: string;
  singleHeroIntro: string;
  multipleHeroIntro: string;
  proposalsTitle: string;
  proposalsDescription: string;
  updatedAt?: string;
};

export const defaultQuoteContentSettings: QuoteContentSettings = {
  singleHeroTitle: "La tua proposta di vacanza a Ischia",
  multipleHeroTitle: "Le tue proposte di vacanza a Ischia",
  singleHeroIntro: "abbiamo preparato una proposta personalizzata per il tuo soggiorno.",
  multipleHeroIntro: "abbiamo preparato più proposte per il tuo soggiorno a Ischia. Confronta le opzioni e conferma quella che preferisci.",
  proposalsTitle: "Le proposte selezionate per te",
  proposalsDescription: "Confronta le soluzioni disponibili e conferma l'opzione che preferisci."
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
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}
