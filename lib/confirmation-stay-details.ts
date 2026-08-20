import type { Quote, QuoteHotelOption } from "@/lib/types";

type MetadataRoom = {
  roomNumber?: number;
  optionId?: string;
  hotelGroup?: number;
  hotelName?: string;
  roomTypeLabel?: string;
  treatmentKey?: string;
  treatmentLabel?: string;
  price?: number;
  depositAmount?: number;
  balanceAmount?: number;
};

function metadataRooms(metadata: Record<string, unknown> | undefined): MetadataRoom[] {
  const rooms = metadata?.selected_rooms;
  if (!Array.isArray(rooms)) return [];
  return rooms.filter((room): room is MetadataRoom => Boolean(room) && typeof room === "object");
}

function uniqueLabels(labels: Array<string | undefined>) {
  return Array.from(new Set(labels.map((label) => label?.trim()).filter((label): label is string => Boolean(label))));
}

export function selectedRoomTypeLabel(quote: Quote): string | undefined {
  const confirmation = quote.confirmation;
  const parsedStoredTreatment = parseStoredRoomComposition(confirmation?.selectedTreatmentLabel);
  if (parsedStoredTreatment.roomLabels.length === 1) return parsedStoredTreatment.roomLabels[0];
  if (parsedStoredTreatment.roomLabels.length > 1) return parsedStoredTreatment.roomLabels.join(" + ");

  const roomLabels = uniqueLabels(metadataRooms(confirmation?.metadata).map((room) => room.roomTypeLabel));
  if (roomLabels.length === 1) return roomLabels[0];
  if (roomLabels.length > 1) return roomLabels.join(" + ");

  const roomLabelFromStoredTreatment = roomTypeFromStoredTreatment(confirmation?.selectedTreatmentLabel);
  if (roomLabelFromStoredTreatment) return roomLabelFromStoredTreatment;

  const selectedOption = selectedConfirmationOption(quote);
  return selectedOption?.roomTypeLabel?.trim() || undefined;
}

export function selectedTreatmentLabel(quote: Quote): string | undefined {
  const label = quote.confirmation?.selectedTreatmentLabel?.trim();
  const parsedStoredTreatment = parseStoredRoomComposition(label);
  if (parsedStoredTreatment.treatmentLabels.length === 1) return parsedStoredTreatment.treatmentLabels[0];
  if (parsedStoredTreatment.treatmentLabels.length > 1) return parsedStoredTreatment.treatmentLabels.join(" + ");

  const roomLabel = selectedRoomTypeLabel(quote);
  if (!label) return undefined;
  if (!roomLabel) return label;

  const normalized = label.toLowerCase();
  const normalizedRoom = roomLabel.toLowerCase();
  if (normalized === normalizedRoom) return undefined;
  if (normalized.startsWith(`${normalizedRoom}, `)) return label.slice(roomLabel.length + 2).trim() || undefined;
  if (normalized.startsWith(`${normalizedRoom} - `)) return label.slice(roomLabel.length + 3).trim() || undefined;
  return label;
}

export function selectedConfirmationOption(quote: Quote): QuoteHotelOption | undefined {
  const optionId = quote.confirmation?.selectedHotelOptionId;
  if (!optionId) return undefined;
  return quote.hotelOptions.find((option) => option.id === optionId);
}

export function voucherGuestsLabel(quote: Quote): string | undefined {
  const guestsParts: string[] = [];
  if (quote.adults) guestsParts.push(`${quote.adults} ${quote.adults === 1 ? "adulto" : "adulti"}`);
  if (quote.children?.length) guestsParts.push(`${quote.children.length} ${quote.children.length === 1 ? "bambino" : "bambini"}`);
  return guestsParts.length ? guestsParts.join(", ") : undefined;
}

function roomTypeFromStoredTreatment(value: string | undefined) {
  const label = value?.trim();
  if (!label) return undefined;
  const match = /^(camera\s+[^,;-]+)/i.exec(label);
  return match?.[1]?.trim();
}

function parseStoredRoomComposition(value: string | undefined) {
  const roomLabels: string[] = [];
  const treatmentLabels: string[] = [];
  const segments = (value ?? "").split(";").map((segment) => segment.trim()).filter(Boolean);

  for (const segment of segments) {
    const withoutPrefix = segment.replace(/^camera\s+\d+\s*:\s*/i, "").trim();
    if (withoutPrefix === segment) continue;

    const commaIndex = withoutPrefix.indexOf(",");
    if (commaIndex === -1) {
      roomLabels.push(withoutPrefix);
      continue;
    }

    const roomLabel = withoutPrefix.slice(0, commaIndex).trim();
    const treatmentLabel = withoutPrefix.slice(commaIndex + 1).trim();
    if (roomLabel) roomLabels.push(roomLabel);
    if (treatmentLabel) treatmentLabels.push(treatmentLabel);
  }

  return {
    roomLabels: uniqueLabels(roomLabels),
    treatmentLabels: uniqueLabels(treatmentLabels)
  };
}
