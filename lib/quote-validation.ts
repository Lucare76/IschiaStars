export type QuoteHotelOptionValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateQuoteHotelOptions(value: unknown, options: { requirePrice: boolean }): QuoteHotelOptionValidationResult {
  if (value == null) return options.requirePrice ? { ok: false, error: "Inserisci almeno un prezzo in almeno una struttura" } : { ok: true };
  if (!Array.isArray(value)) return { ok: false, error: "Formato proposte hotel non valido" };

  const groupCount = new Set(value.map((item) => {
    const option = isRecord(item) ? item : {};
    return Number(option.hotelGroup ?? option.position ?? 1);
  })).size;

  if (groupCount > 3 || value.length > 9) {
    return { ok: false, error: "Massimo 3 strutture per preventivo" };
  }

  if (options.requirePrice && !hasAtLeastOneHotelOptionPrice(value)) {
    return { ok: false, error: "Inserisci almeno un prezzo in almeno una struttura" };
  }

  return { ok: true };
}

export function hasAtLeastOneHotelOptionPrice(value: unknown[]) {
  return value.some((item) => {
    if (!isRecord(item)) return false;
    return hasPositiveNumberLike(item.breakfastPrice) || hasPositiveNumberLike(item.halfBoardPrice) || hasPositiveNumberLike(item.fullBoardPrice);
  });
}

function hasPositiveNumberLike(value: unknown) {
  if (value === "" || value == null) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
