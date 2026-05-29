export type QuoteStatus = "da_evadere" | "in_lavorazione" | "preventivo_inviato" | "confermato" | "perso_non_disponibile";

export type ChildGuest = {
  id: string;
  firstName: string;
  birthDate: string;
};

export type Hotel = {
  id: string;
  name: string;
  zone: string;
  stars: number;
  description: string;
  imageUrl?: string;
  sourceUrl?: string;
  slug?: string;
  standardServices: string[];
  paymentPolicy: string;
  cancellationPolicy: string;
  internalNotes: string;
  active: boolean;
};

export type QuoteRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  destination: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: ChildGuest[];
  rooms: number;
  requestedTreatment?: string;
  message?: string;
  receivedAt: string;
  status: QuoteStatus;
  requestedHotel?: string;
};

export type QuoteEvent = {
  id: string;
  quoteId: string;
  eventType: "quote_opened" | "whatsapp_clicked" | "confirm_clicked" | "quote_confirmed" | "print_clicked";
  createdAt: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export type QuoteConfirmation = {
  confirmedAt: string;
  fiscalCode: string;
  address: string;
  city: string;
  zip: string;
  province: string;
};

export type TransportOffer = {
  id: string;
  type: "train" | "ferry" | "hydrofoil";
  title: string;
  description: string;
  price?: number;
  notes?: string;
};

export type Quote = {
  id: string;
  code: string;
  token: string;
  requestId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  requestedHotel: string;
  proposedHotel: Hotel;
  alternativeHotel?: Hotel;
  isAlternative: boolean;
  unavailableRequestedHotel: boolean;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: ChildGuest[];
  rooms: number;
  treatment: string;
  totalPrice: number;
  deposit: number;
  offerExpiresAt: string;
  servicesIncluded: string[];
  transportOffers?: TransportOffer[];
  paymentPolicy: string;
  cancellationPolicy: string;
  internalNotes: string;
  customerNotes: string;
  status: QuoteStatus;
  createdAt: string;
  sentAt?: string;
  confirmation?: QuoteConfirmation;
};
