export const QUOTE_CHIP_SETTINGS_KEY = "quote_chip_settings";

export type RoomTypePresetSetting = {
  label: string;
  capacity: number;
};

export type QuoteChipSettings = {
  publicNoteChips: string[];
  hotelNoteChips: string[];
  hotelReasonPhrases: string[];
  treatmentDetailPhrases: string[];
  roomTypePresets: RoomTypePresetSetting[];
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
  ],
  hotelReasonPhrases: [
    "Struttura centrale, facile da raggiungere",
    "Ottimo rapporto qualità/prezzo",
    "Trattamento termale incluso",
    "Ideale per famiglie con bambini",
    "Vista mare garantita",
    "Struttura tranquilla, lontana dal caos",
    "Consigliato per coppie",
    "Uno dei più richiesti della stagione",
    "Struttura confortevole a 5 minuti dal centro"
  ],
  treatmentDetailPhrases: [
    "Bevande escluse",
    "Bevande incluse ai pasti",
    "Acqua ai pasti inclusa",
    "Prima colazione a buffet",
    "Cena con menù fisso",
    "Accesso spa/terme incluso",
    "Spiaggia convenzionata inclusa",
    "Parcheggio incluso",
    "Transfer incluso",
    "Extra esclusi salvo diversa indicazione"
  ],
  roomTypePresets: [
    { label: "Camera singola standard", capacity: 1 },
    { label: "Camera matrimoniale standard", capacity: 2 },
    { label: "Camera matrimoniale con balcone", capacity: 2 },
    { label: "Camera tripla standard", capacity: 3 },
    { label: "Camera tripla con balcone", capacity: 3 },
    { label: "Camera quadrupla standard", capacity: 4 },
    { label: "Camera quadrupla con balcone", capacity: 4 }
  ]
};

export function normalizeQuoteChipSettings(value: unknown): QuoteChipSettings {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    publicNoteChips: normalizeChipList(record.public_note_chips ?? record.publicNoteChips, defaultQuoteChipSettings.publicNoteChips),
    hotelNoteChips: normalizeChipList(record.hotel_note_chips ?? record.hotelNoteChips, defaultQuoteChipSettings.hotelNoteChips),
    hotelReasonPhrases: normalizeChipList(record.hotel_reason_phrases ?? record.hotelReasonPhrases, defaultQuoteChipSettings.hotelReasonPhrases),
    treatmentDetailPhrases: normalizeChipList(record.treatment_detail_phrases ?? record.treatmentDetailPhrases, defaultQuoteChipSettings.treatmentDetailPhrases),
    roomTypePresets: normalizeRoomTypePresets(record.room_type_presets ?? record.roomTypePresets, defaultQuoteChipSettings.roomTypePresets),
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
    hotel_reason_phrases: normalized.hotelReasonPhrases,
    treatment_detail_phrases: normalized.treatmentDetailPhrases,
    room_type_presets: normalized.roomTypePresets,
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

function normalizeRoomTypePresets(value: unknown, fallback: RoomTypePresetSetting[]) {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const normalized = value
    .map((item): RoomTypePresetSetting | null => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? { label, capacity: inferRoomTypeCapacity(label) } : null;
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const capacity = Number(record.capacity);
      if (!label) return null;
      return {
        label,
        capacity: Number.isInteger(capacity) && capacity >= 1 && capacity <= 10 ? capacity : inferRoomTypeCapacity(label)
      };
    })
    .filter((item): item is RoomTypePresetSetting => Boolean(item))
    .filter((item) => {
      const key = item.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return item.label.length <= 120;
    })
    .slice(0, 30);

  return normalized.length ? normalized : fallback;
}

function inferRoomTypeCapacity(label: string) {
  const normalized = label.toLowerCase();
  if (/\b(singola|single)\b/.test(normalized)) return 1;
  if (/\b(matrimoniale|doppia|double|twin)\b/.test(normalized)) return 2;
  if (/\b(tripla|triple)\b/.test(normalized)) return 3;
  if (/\b(quadrupla|quadruple|family|familiare)\b/.test(normalized)) return 4;
  return 2;
}
