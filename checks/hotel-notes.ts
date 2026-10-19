import assert from "node:assert/strict";
import { buildHotelNotes } from "../lib/hotel-notes";

const COMMITMENT = "Tariffa riservata ai clienti con impegnativa per fanghi e bagni termali";

// Note vuote e nessuna impegnativa -> blocco assente
assert.deepEqual(buildHotelNotes([{ notes: "" }, { notes: "  \n " }, {}], null), { notes: [], commitmentNote: undefined });
assert.deepEqual(buildHotelNotes([{ notes: undefined }], "   "), { notes: [], commitmentNote: undefined });

// Solo commitmentNote
assert.deepEqual(buildHotelNotes([{ notes: "" }], `  ${COMMITMENT} `), { notes: [], commitmentNote: COMMITMENT });

// AV CLUB Terme Colella: due righe di note
assert.deepEqual(
  buildHotelNotes([{ notes: "Costi intesi per ogni camera\nOfferta libera senza impegnativa medica termale" }]),
  { notes: ["Costi intesi per ogni camera", "Offerta libera senza impegnativa medica termale"], commitmentNote: undefined }
);

// Tramonto d'Oro: note + impegnativa, più tipologie camera con righe ripetute
assert.deepEqual(
  buildHotelNotes(
    [
      { notes: "Costi intesi per ogni camera\n\nSenza impegnativa medica supplemento di € 100 per persona adulta\n" },
      { notes: "costi intesi  per ogni camera" },
      { notes: COMMITMENT }
    ],
    COMMITMENT
  ),
  {
    notes: ["Costi intesi per ogni camera", "Senza impegnativa medica supplemento di € 100 per persona adulta"],
    commitmentNote: COMMITMENT
  }
);

console.log("hotel notes checks passed");
