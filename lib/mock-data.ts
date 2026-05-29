import { Hotel, Quote, QuoteEvent, QuoteRequest, QuoteStatus } from "@/lib/types";

export const hotels: Hotel[] = [
  {
    id: "hotel-felix",
    name: "Hotel Terme Felix",
    zone: "Ischia Porto",
    stars: 4,
    description: "Hotel centrale con piscine termali, ideale per una vacanza comoda tra porto, centro e relax.",
    imageUrl: "https://ischiastars.it/wp-content/uploads/2026/05/hotel-terme-felix-ischia.jpg",
    standardServices: ["Camera comfort", "Piscine termali", "Assistenza IschiaStars", "Wi-Fi nelle aree comuni"],
    paymentPolicy: "Acconto alla conferma e saldo secondo condizioni della struttura.",
    cancellationPolicy: "Cancellazione secondo policy comunicata nel preventivo prima della conferma.",
    internalNotes: "Buona proposta per coppie e famiglie che vogliono restare centrali.",
    active: true
  },
  {
    id: "hotel-san-lorenzo",
    name: "Hotel San Lorenzo",
    zone: "Lacco Ameno",
    stars: 4,
    description: "Struttura elegante in zona Lacco Ameno, adatta a soggiorni relax e benessere.",
    imageUrl: "https://ischiastars.it/wp-content/uploads/2026/05/hotel-san-lorenzo-ischia.jpg",
    standardServices: ["Prima colazione", "Area relax", "Percorso benessere", "Assistenza WhatsApp"],
    paymentPolicy: "Acconto del 30% alla conferma, saldo secondo disponibilita struttura.",
    cancellationPolicy: "Penali variabili in base alla tariffa confermata.",
    internalNotes: "Verificare camere superior nei periodi di alta stagione.",
    active: true
  },
  {
    id: "hotel-president",
    name: "Hotel President Terme",
    zone: "Ischia Porto",
    stars: 4,
    description: "Hotel termale con servizi completi, atmosfera classica e posizione pratica per muoversi sull'isola.",
    imageUrl: "https://ischiastars.it/wp-content/uploads/2026/05/hotel-president-terme-ischia.jpg",
    standardServices: ["Mezza pensione", "Piscina termale", "Centro benessere", "Assistenza IschiaStars"],
    paymentPolicy: "Acconto richiesto alla conferma, saldo in struttura salvo condizioni diverse.",
    cancellationPolicy: "Cancellazione gratuita entro la data indicata nel preventivo, salvo tariffe speciali.",
    internalNotes: "Ottima alternativa quando San Lorenzo non ha disponibilita.",
    active: true
  },
  {
    id: "formula-roulette",
    name: "Formula Roulette 4 Stelle",
    zone: "Ischia",
    stars: 4,
    description: "Formula flessibile su hotel 4 stelle selezionati, pensata per ottimizzare qualita e prezzo.",
    imageUrl: "https://ischiastars.it/wp-content/uploads/2026/05/ischia-hotel-4-stelle.jpg",
    standardServices: ["Hotel 4 stelle selezionato", "Trattamento indicato nel preventivo", "Assistenza diretta", "Soluzione su misura"],
    paymentPolicy: "Acconto alla conferma, saldo secondo struttura assegnata.",
    cancellationPolicy: "Condizioni comunicate prima della conferma definitiva.",
    internalNotes: "Usare per famiglie e clienti flessibili sulla struttura.",
    active: true
  }
];

export const quoteRequests: QuoteRequest[] = [
  {
    id: "req-001",
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario.rossi@example.com",
    phone: "+39 347 111 2233",
    destination: "Ischia Porto",
    arrivalDate: "2026-07-12",
    departureDate: "2026-07-19",
    adults: 2,
    children: [{ id: "child-mario-1", firstName: "Luca", birthDate: "2018-04-18" }],
    rooms: 1,
    requestedTreatment: "Mezza pensione",
    requestedHotel: "Hotel Terme Felix",
    message: "Vorremmo piscina termale e una soluzione comoda per il centro.",
    receivedAt: "2026-05-10T09:45:00+02:00",
    status: "da_evadere"
  },
  {
    id: "req-002",
    firstName: "Laura",
    lastName: "Bianchi",
    email: "laura.bianchi@example.com",
    phone: "+39 333 222 4455",
    destination: "Lacco Ameno",
    arrivalDate: "2026-06-20",
    departureDate: "2026-06-27",
    adults: 2,
    children: [],
    rooms: 1,
    requestedTreatment: "Prima colazione",
    requestedHotel: "Hotel San Lorenzo",
    message: "Preferiamo una struttura elegante, tranquilla e con servizi benessere.",
    receivedAt: "2026-05-09T16:10:00+02:00",
    status: "preventivo_inviato"
  },
  {
    id: "req-003",
    firstName: "Famiglia",
    lastName: "Esposito",
    email: "famiglia.esposito@example.com",
    phone: "+39 371 759 0017",
    destination: "Ischia",
    arrivalDate: "2026-08-04",
    departureDate: "2026-08-11",
    adults: 2,
    children: [
      { id: "child-esposito-1", firstName: "Anna", birthDate: "2016-05-10" },
      { id: "child-esposito-2", firstName: "Marco", birthDate: "2020-09-22" }
    ],
    rooms: 1,
    requestedTreatment: "Pensione completa",
    requestedHotel: "Hotel Terme Felix",
    message: "Vorremmo l'Hotel Terme Felix, pensione completa e una soluzione adatta ai bambini.",
    receivedAt: "2026-05-08T11:22:00+02:00",
    status: "preventivo_inviato"
  }
];

export const quotes: Quote[] = [
  {
    id: "quote-001",
    code: "IS-2026-001",
    token: "preview-token-ischiastars",
    requestId: "req-002",
    customerFirstName: "Laura",
    customerLastName: "Bianchi",
    customerEmail: "laura.bianchi@example.com",
    customerPhone: "+39 333 222 4455",
    requestedHotel: "Hotel San Lorenzo",
    proposedHotel: hotels[1],
    isAlternative: false,
    unavailableRequestedHotel: false,
    arrivalDate: "2026-06-20",
    departureDate: "2026-06-27",
    adults: 2,
    children: [],
    rooms: 1,
    treatment: "Prima colazione",
    totalPrice: 1450,
    deposit: 360,
    offerExpiresAt: "2026-05-30",
    servicesIncluded: hotels[1].standardServices,
    transportOffers: [],
    paymentPolicy: hotels[1].paymentPolicy,
    cancellationPolicy: hotels[1].cancellationPolicy,
    internalNotes: "Proposta aperta dalla cliente dopo invio WhatsApp.",
    customerNotes: "Abbiamo selezionato una proposta elegante e tranquilla a Lacco Ameno, con servizi benessere e assistenza IschiaStars.",
    status: "preventivo_inviato",
    createdAt: "2026-05-09T17:00:00+02:00",
    sentAt: "2026-05-09T17:20:00+02:00",
    excludedFromStats: false
  },
  {
    id: "quote-002",
    code: "IS-2026-002",
    token: "preview-token-famiglia-esposito",
    requestId: "req-003",
    customerFirstName: "Famiglia",
    customerLastName: "Esposito",
    customerEmail: "famiglia.esposito@example.com",
    customerPhone: "+39 371 759 0017",
    requestedHotel: "Hotel Terme Felix",
    proposedHotel: hotels[2],
    alternativeHotel: hotels[2],
    isAlternative: true,
    unavailableRequestedHotel: true,
    arrivalDate: "2026-08-04",
    departureDate: "2026-08-11",
    adults: 2,
    children: [
      { id: "child-esposito-1", firstName: "Anna", birthDate: "2016-05-10" },
      { id: "child-esposito-2", firstName: "Marco", birthDate: "2020-09-22" }
    ],
    rooms: 1,
    treatment: "Pensione completa",
    totalPrice: 2380,
    deposit: 595,
    offerExpiresAt: "2026-05-31",
    servicesIncluded: hotels[2].standardServices,
    transportOffers: [],
    paymentPolicy: hotels[2].paymentPolicy,
    cancellationPolicy: hotels[2].cancellationPolicy,
    internalNotes: "Felix non disponibile: proposta President Terme per famiglia.",
    customerNotes: "La struttura richiesta non è disponibile per le date selezionate. Abbiamo selezionato per te una proposta alternativa con caratteristiche simili.",
    status: "preventivo_inviato",
    createdAt: "2026-05-08T12:00:00+02:00",
    sentAt: "2026-05-08T12:20:00+02:00",
    excludedFromStats: false
  },
  {
    id: "quote-003",
    code: "IS-2026-003",
    token: "preview-token-anna-romano",
    requestId: "manual-anna-romano",
    customerFirstName: "Anna",
    customerLastName: "Romano",
    customerEmail: "anna.romano@example.com",
    customerPhone: "+39 333 908 1122",
    requestedHotel: "Formula Roulette 4 Stelle",
    proposedHotel: hotels[3],
    isAlternative: false,
    unavailableRequestedHotel: false,
    arrivalDate: "2026-08-04",
    departureDate: "2026-08-11",
    adults: 2,
    children: [
      { id: "child-esposito-1", firstName: "Anna", birthDate: "2016-05-10" },
      { id: "child-esposito-2", firstName: "Marco", birthDate: "2020-09-22" }
    ],
    rooms: 1,
    treatment: "Pensione completa",
    totalPrice: 2380,
    deposit: 595,
    offerExpiresAt: "2026-05-16",
    servicesIncluded: hotels[3].standardServices,
    transportOffers: [
      {
        id: "transport-esposito-ferry",
        type: "ferry",
        title: "Traghetto famiglia per Ischia",
        description: "Opzione indicata per famiglie, bagagli e possibile auto al seguito.",
        price: 132,
        notes: "Preventivo trasporto da confermare con eta bambini e porto scelto."
      }
    ],
    paymentPolicy: hotels[3].paymentPolicy,
    cancellationPolicy: hotels[3].cancellationPolicy,
    internalNotes: "Esempio gia confermato per statistiche base.",
    customerNotes: "Formula flessibile per famiglia su hotel 4 stelle selezionati con assistenza IschiaStars.",
    status: "confermato",
    createdAt: "2026-05-08T12:00:00+02:00",
    sentAt: "2026-05-08T12:20:00+02:00",
    excludedFromStats: false,
    confirmation: {
      confirmedAt: "2026-05-09T09:05:00+02:00",
      fiscalCode: "SPSFGL80A01F839X",
      address: "Via Roma 10",
      city: "Napoli",
      zip: "80100",
      province: "NA"
    }
  }
];

export const quoteEvents: QuoteEvent[] = [
  { id: "ev-001", quoteId: "quote-001", eventType: "quote_opened", createdAt: "2026-05-10T11:01:00+02:00" },
  { id: "ev-002", quoteId: "quote-001", eventType: "whatsapp_clicked", createdAt: "2026-05-10T11:03:00+02:00" },
  { id: "ev-004", quoteId: "quote-003", eventType: "quote_opened", createdAt: "2026-05-08T13:04:00+02:00" },
  { id: "ev-005", quoteId: "quote-003", eventType: "confirm_clicked", createdAt: "2026-05-09T08:58:00+02:00" },
  { id: "ev-006", quoteId: "quote-003", eventType: "quote_confirmed", createdAt: "2026-05-09T09:05:00+02:00" }
];

export const statusLabels: Record<QuoteStatus, string> = {
  da_evadere: "Da evadere",
  in_lavorazione: "In lavorazione",
  preventivo_inviato: "Preventivo inviato",
  confermato: "Confermato",
  perso_non_disponibile: "Perso / non disponibile"
};
