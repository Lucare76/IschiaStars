export type HotelNotes = {
  notes: string[];
  commitmentNote?: string;
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

// Unisce le note delle tipologie camera di una struttura (una riga per nota, senza duplicati)
// e tiene separata la nota tariffaria sull'impegnativa.
export function buildHotelNotes(options: { notes?: string | null }[], commitmentNote?: string | null): HotelNotes {
  const commitment = commitmentNote?.trim() || undefined;
  const seen = new Set<string>(commitment ? [normalize(commitment)] : []);
  const notes: string[] = [];

  for (const option of options) {
    for (const line of option.notes?.split("\n") ?? []) {
      const note = line.trim();
      const key = normalize(note);
      if (!note || seen.has(key)) continue;
      seen.add(key);
      notes.push(note);
    }
  }

  return { notes, commitmentNote: commitment };
}
