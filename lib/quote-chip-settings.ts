export const QUOTE_CHIP_SETTINGS_KEY = "quote_chip_settings";

export type QuoteChipSettings = {
  publicNoteChips: string[];
  hotelNoteChips: string[];
  updatedAt?: string;
};

export const defaultQuoteChipSettings: QuoteChipSettings = {
  publicNoteChips: [
    "Traghetto da Napoli € 33 a persona a/r con transfer",
    "Ultime disponibilità",
    "Costi intesi per ogni camera",
    "Quota cane 20 euro al giorno da pagare in loco"
  ],
  hotelNoteChips: [
    "Traghetto da Napoli € 33 a persona a/r con transfer",
    "Ultime disponibilità",
    "Costi intesi per ogni camera",
    "Quota cane 20 euro al giorno da pagare in loco"
  ]
};

export function normalizeQuoteChipSettings(value: unknown): QuoteChipSettings {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    publicNoteChips: normalizeChipList(record.public_note_chips ?? record.publicNoteChips, defaultQuoteChipSettings.publicNoteChips),
    hotelNoteChips: normalizeChipList(record.hotel_note_chips ?? record.hotelNoteChips, defaultQuoteChipSettings.hotelNoteChips),
    updatedAt: typeof record.updated_at === "string"
      ? record.updated_at
      : typeof record.updatedAt === "string"
        ? record.updatedAt
        : undefined
  };
}

export function quoteChipSettingsToDbValue(settings: QuoteChipSettings) {
  const normalized = normalizeQuoteChipSettings(settings);
  return {
    public_note_chips: normalized.publicNoteChips,
    hotel_note_chips: normalized.hotelNoteChips,
    updated_at: normalized.updatedAt || new Date().toISOString()
  };
}

function normalizeChipList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return item.length <= 240;
    })
    .slice(0, 30);
}
