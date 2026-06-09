export type QuoteStatus = "da_evadere" | "in_lavorazione" | "preventivo_inviato" | "confermato" | "perso_non_disponibile";

export type ChildGuest = {
  id: string;
  firstName: string;
  birthDate: string;   // empty in quote phase; filled at confirmation
  age?: number;        // declared age at quote/request time
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
  importedAt?: string;
  status: QuoteStatus;
  requestedHotel?: string;
  processedAt?: string;
  processedQuoteId?: string;
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
    | "availability_confirmed"
    | "final_confirmation_email_sent"
    | "deposit_due_at_set"
    | "availability_unavailable"
    | "availability_unavailable_email_sent"
    | "alternative_to_propose"
    | "follow_up_whatsapp_click"
    | "compare_opened"
    | "reveal_options_clicked"
    | "hesitant_whatsapp_clicked"
    | "supplier_confirmation_sent"
    | "reaction_interested"
    | "reaction_too_expensive"
    | "amounts_updated";
  createdAt: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export type QuoteConfirmation = {
  id?: string;
  confirmedAt: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  fiscalCode: string;
  address: string;
  city: string;
  zip: string;
  province: string;
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
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
  metadata?: Record<string, unknown>;
  availabilityStatus?: ConfirmationAvailabilityStatus;
  depositDueAt?: string;
  depositPaidAt?: string | null;
  balancePaidAt?: string | null;
  finalConfirmationSentAt?: string;
  finalConfirmationNotes?: string;
  unavailableReason?: string;
  unavailabilityEmailSentAt?: string;
  availabilityUpdatedAt?: string;
};

export type ConfirmationAvailabilityStatus =
  | "availability_to_check"
  | "availability_confirmed"
  | "final_confirmation_sent"
  | "deposit_waiting"
  | "availability_unavailable"
  | "alternative_to_propose";

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
  badge?: string | null;
  hotelReason?: string | null;
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
  breakfastDetails?: string | null;
  halfBoardDetails?: string | null;
  fullBoardDetails?: string | null;
  includedServices?: string;
  depositPercent?: number;
  balanceMethod?: string;
  paymentPolicy?: string;
  cancellationPolicy?: string;
  paymentNotes?: string;
  notes?: string;
  commitmentNote?: string | null;
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
