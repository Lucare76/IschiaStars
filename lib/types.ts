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
  externalImageUrl?: string;
  sourceUrl?: string;
  slug?: string;
  standardServices: string[];
  defaultDepositPercent?: number;
  defaultBalanceMethod?: string;
  defaultPaymentNotes?: string;
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
  eventType:
    | "quote_opened"
    | "whatsapp_clicked"
    | "confirm_clicked"
    | "quote_confirmed"
    | "print_clicked"
    | "hotel_link_clicked"
    | "details_opened"
    | "follow_up_whatsapp_click";
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
  selectedHotelOptionId?: string;
  selectedHotelName?: string;
  selectedTreatmentKey?: TreatmentKey | string;
  selectedTreatmentLabel?: string;
  selectedPrice?: number;
  selectedDepositPercent?: number;
  selectedDepositAmount?: number;
  selectedBalanceAmount?: number;
  selectedBalanceMethod?: string;
  selectedPaymentPolicy?: string;
  selectedCancellationPolicy?: string;
  paymentSettingsSnapshot?: Record<string, unknown>;
};

export type TransportOffer = {
  id: string;
  type: "train" | "ferry" | "hydrofoil";
  title: string;
  description: string;
  price?: number;
  notes?: string;
};

export type TreatmentKey = "breakfast" | "half_board" | "full_board";

export type TreatmentOption = {
  key: TreatmentKey;
  label: string;
  price: number;
};

export type QuoteHotelOption = {
  id: string;
  quoteId: string;
  hotelId?: string;
  hotelGroup: number;
  position: number;
  roomTypeLabel?: string;
  hotelName: string;
  hotelLocation?: string;
  hotelStars?: number;
  hotelImageUrl?: string;
  sourceUrl?: string;
  breakfastPrice?: number;
  halfBoardPrice?: number;
  fullBoardPrice?: number;
  breakfastLabel: string;
  halfBoardLabel: string;
  fullBoardLabel: string;
  includedServices?: string;
  depositPercent?: number;
  balanceMethod?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
  paymentNotes?: string;
  notes?: string;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
  treatments: TreatmentOption[];
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
  excludedFromStats: boolean;
  deletedAt?: string;
  hotelOptions: QuoteHotelOption[];
};
