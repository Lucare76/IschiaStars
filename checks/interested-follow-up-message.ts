import assert from "node:assert/strict";
import { buildInterestedFollowUpMessage, interestedHotelPriceText } from "../lib/interested-follow-up-message";
import type { Quote, QuoteHotelOption, TreatmentOption } from "../lib/types";
import { formatCurrency } from "../lib/utils";

const HOTEL = "AV CLUB Terme Colella – Forio d’Ischia";

const option = (roomTypeLabel: string | undefined, treatments: TreatmentOption[], extra: Partial<QuoteHotelOption> = {}): QuoteHotelOption => ({
  id: crypto.randomUUID(),
  quoteId: "quote-1",
  hotelGroup: 1,
  position: 1,
  roomTypeLabel,
  hotelName: HOTEL,
  breakfastLabel: "Camera e colazione",
  halfBoardLabel: "Mezza pensione",
  fullBoardLabel: "Pensione completa",
  isSelected: false,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  treatments,
  ...extra
});

const halfBoard = (price: number): TreatmentOption => ({ key: "half_board", label: "Mezza pensione", price });

const quote = (overrides: Partial<Quote>): Quote => ({
  id: "quote-1",
  code: "IS-TEST",
  token: "token",
  requestId: "req-1",
  customerFirstName: "Magda",
  customerLastName: "Test",
  customerEmail: "test@example.com",
  customerPhone: "3330000000",
  requestedHotel: HOTEL,
  proposedHotel: {
    id: "h1", name: HOTEL, zone: "Forio", stars: 4, description: "", standardServices: [],
    paymentPolicy: "", cancellationPolicy: "", internalNotes: "", active: true
  },
  isAlternative: false,
  unavailableRequestedHotel: false,
  arrivalDate: "2026-12-30",
  departureDate: "2027-01-04",
  adults: 6,
  children: [],
  rooms: 3,
  treatment: "Mezza pensione",
  totalPrice: 0,
  deposit: 0,
  offerExpiresAt: "2026-11-30",
  servicesIncluded: [],
  paymentPolicy: "",
  cancellationPolicy: "",
  internalNotes: "",
  customerNotes: "",
  status: "preventivo_inviato",
  createdAt: "2026-10-01T00:00:00Z",
  excludedFromStats: false,
  hotelOptions: [],
  ...overrides
});

const eur = (value: number) => formatCurrency(value);

// 1. Una camera da 870 €
{
  const q = quote({ rooms: 1, adults: 2, hotelOptions: [option("Matrimoniale", [halfBoard(870)])] });
  assert.equal(interestedHotelPriceText(q, HOTEL)?.text, `${eur(870)} per camera`);
}

// 2. Tre camere identiche da 870 € (6 adulti): niente "per 6 adulti", niente totale moltiplicato
{
  const q = quote({ rooms: 3, adults: 6, totalPrice: 2610, hotelOptions: [option("Matrimoniale", [halfBoard(870)])] });
  const message = buildInterestedFollowUpMessage(q, HOTEL, 1);
  assert.equal(message, `Ciao Magda 😊
ho visto che ti interessa l’${HOTEL} per il periodo 30 dicembre–4 gennaio.
La proposta è ancora molto interessante: ${eur(870)} per camera.
Vuoi che controllo subito la disponibilità aggiornata e, se è tutto ok, ti spiego come bloccarla?`);
  assert.doesNotMatch(message, /adult/);
  assert.ok(!message.includes(eur(2610)));
  assert.doesNotMatch(message, /totali/);
}

// 3a. Tipologie con prezzi diversi -> dettaglio per tipologia
{
  const q = quote({
    hotelOptions: [
      option("Matrimoniale", [halfBoard(870)]),
      option("Tripla", [halfBoard(1050)], { position: 2 }),
      option("Singola", [halfBoard(620)], { position: 3 })
    ]
  });
  const message = buildInterestedFollowUpMessage(q, HOTEL, 1);
  assert.ok(message.includes(`La proposta è ancora molto interessante:\nMatrimoniale ${eur(870)} · Tripla ${eur(1050)} · Singola ${eur(620)}.`));
}

// 3b. Tipologie senza etichetta (dettaglio non ricostruibile) -> mostra il prezzo minimo per camera senza "a partire da"
{
  const q = quote({ hotelOptions: [option(undefined, [halfBoard(870)]), option(undefined, [halfBoard(620)], { position: 2 })] });
  assert.equal(interestedHotelPriceText(q, HOTEL)?.text, `${eur(620)} per camera`);
}

// 3c. Più trattamenti per tipologia -> mostra il prezzo minimo per camera senza "a partire da"
{
  const q = quote({
    hotelOptions: [
      option("Matrimoniale", [{ key: "breakfast", label: "Camera e colazione", price: 800 }, halfBoard(870)]),
      option("Tripla", [halfBoard(1050)], { position: 2 })
    ]
  });
  assert.equal(interestedHotelPriceText(q, HOTEL)?.text, `${eur(800)} per camera`);
}

// 3d. Stessa tipologia/prezzo su più opzioni -> un solo prezzo per camera
{
  const q = quote({ hotelOptions: [option("Matrimoniale", [halfBoard(870)]), option("Matrimoniale", [halfBoard(870)], { position: 2 })] });
  assert.equal(interestedHotelPriceText(q, HOTEL)?.text, `${eur(870)} per camera`);
}

// 3e. Il gruppo hotel della reazione ha precedenza; le altre strutture sono ignorate
{
  const q = quote({
    hotelOptions: [
      option("Matrimoniale", [halfBoard(870)]),
      option("Doppia", [halfBoard(500)], { hotelGroup: 2, hotelName: "Altro Hotel" }),
      option("Matrimoniale", [halfBoard(990)], { hotelGroup: 3 })
    ]
  });
  assert.equal(interestedHotelPriceText(q, HOTEL, 1)?.text, `${eur(870)} per camera`);
  assert.equal(interestedHotelPriceText(q, HOTEL, 3)?.text, `${eur(990)} per camera`);
}

// 4. Nessun prezzo disponibile -> nessun importo inventato
{
  const q = quote({ hotelOptions: [option("Matrimoniale", [halfBoard(0)]), option("Doppia", [])] });
  assert.equal(interestedHotelPriceText(q, HOTEL), null);
  const message = buildInterestedFollowUpMessage(q, HOTEL);
  assert.ok(message.includes("La proposta è ancora molto interessante.\n"));
  assert.doesNotMatch(message, /€/);
}

// 5. totalPrice già valorizzato -> nessuna doppia moltiplicazione
{
  // Con hotelOptions il totalPrice è ignorato e il prezzo camera non viene moltiplicato per le camere.
  const withOptions = quote({ rooms: 3, totalPrice: 2610, hotelOptions: [option("Matrimoniale", [halfBoard(870)])] });
  assert.equal(interestedHotelPriceText(withOptions, HOTEL)?.text, `${eur(870)} per camera`);

  // Senza hotelOptions il totalPrice è il totale pratica: mostrato tale e quale, mai moltiplicato né spacciato per camera.
  const totalOnly = quote({ rooms: 3, totalPrice: 2610, hotelOptions: [] });
  assert.equal(interestedHotelPriceText(totalOnly, HOTEL)?.text, `${eur(2610)} in totale`);

  const singleRoomTotal = quote({ rooms: 1, totalPrice: 870, hotelOptions: [] });
  assert.equal(interestedHotelPriceText(singleRoomTotal, HOTEL)?.text, `${eur(870)} per camera`);
}

// Date nello stesso mese restano nel formato breve
{
  const q = quote({ arrivalDate: "2026-08-01", departureDate: "2026-08-05", hotelOptions: [option("Matrimoniale", [halfBoard(870)])] });
  assert.ok(buildInterestedFollowUpMessage(q, HOTEL).includes("per il periodo 1-5 agosto."));
}

console.log("interested follow-up message: ok");
