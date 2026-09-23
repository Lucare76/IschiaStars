export const QUOTE_CONTENT_SETTINGS_KEY = "quote_content_settings";

export type QuoteContentSettings = {
  singleHeroTitle: string;
  multipleHeroTitle: string;
  singleHeroIntro: string;
  multipleHeroIntro: string;
  proposalsTitle: string;
  proposalsDescription: string;
  headerWhatsappLabel: string;
  mainWhatsappLabel: string;
  mainConfirmLabel: string;
  mobileWhatsappLabel: string;
  travelEyebrow: string;
  travelTitle: string;
  travelDescription: string;
  travelDisclaimer: string;
  travelCta: string;
  updatedAt?: string;
};

export const defaultQuoteContentSettings: QuoteContentSettings = {
  singleHeroTitle: "La tua proposta di vacanza a Ischia",
  multipleHeroTitle: "Le tue proposte di vacanza a Ischia",
  singleHeroIntro: "abbiamo preparato una proposta personalizzata per il tuo soggiorno.",
  multipleHeroIntro: "abbiamo preparato più proposte per il tuo soggiorno a Ischia. Confronta le opzioni e conferma quella che preferisci.",
  proposalsTitle: "Le proposte selezionate per te",
  proposalsDescription: "Confronta le soluzioni disponibili e conferma l'opzione che preferisci.",
  headerWhatsappLabel: "WhatsApp",
  mainWhatsappLabel: "Hai domande? Scrivici su WhatsApp",
  mainConfirmLabel: "Conferma il preventivo",
  mobileWhatsappLabel: "Hai domande? WhatsApp",
  travelEyebrow: "Organizza anche il viaggio",
  travelTitle: "Vuoi arrivare a Ischia senza pensieri?",
  travelDescription: "Oltre al soggiorno, possiamo aiutarti a scegliere il collegamento più comodo per raggiungere la struttura.",
  travelDisclaimer: "Le tariffe sono indicative e possono variare in base a data, disponibilità e orari.",
  travelCta: "Rispondi a questa email o scrivici su WhatsApp: ti consiglieremo la soluzione più adatta al tuo viaggio."
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
    headerWhatsappLabel: cleanText(raw.headerWhatsappLabel, defaultQuoteContentSettings.headerWhatsappLabel, 60),
    mainWhatsappLabel: cleanText(raw.mainWhatsappLabel, defaultQuoteContentSettings.mainWhatsappLabel, 100),
    mainConfirmLabel: cleanText(raw.mainConfirmLabel, defaultQuoteContentSettings.mainConfirmLabel, 80),
    mobileWhatsappLabel: cleanText(raw.mobileWhatsappLabel, defaultQuoteContentSettings.mobileWhatsappLabel, 80),
    travelEyebrow: cleanText(raw.travelEyebrow, defaultQuoteContentSettings.travelEyebrow, 80),
    travelTitle: cleanText(raw.travelTitle, defaultQuoteContentSettings.travelTitle, 140),
    travelDescription: cleanText(raw.travelDescription, defaultQuoteContentSettings.travelDescription, 500),
    travelDisclaimer: cleanText(raw.travelDisclaimer, defaultQuoteContentSettings.travelDisclaimer, 300),
    travelCta: cleanText(raw.travelCta, defaultQuoteContentSettings.travelCta, 300),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}
