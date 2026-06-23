import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import type { Quote, TreatmentOption } from "@/lib/types";

export type PublicQuoteChildDTO = {
  id: string;
  age?: number;
};

export type PublicQuoteHotelOptionDTO = {
  id: string;
  hotelGroup: number;
  badge?: string | null;
  hotelReason?: string | null;
  roomTypeLabel?: string;
  hotelName: string;
  hotelLocation?: string;
  hotelStars?: number;
  hotelImageUrl?: string;
  sourceUrl?: string;
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
  treatments: TreatmentOption[];
};

export type PublicQuoteDTO = {
  id: string;
  code: string;
  token: string;
  publicShortCode?: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  requestedHotel: string;
  isAlternative: boolean;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: PublicQuoteChildDTO[];
  rooms: number;
  offerExpiresAt: string;
  customerNotes: string;
  status: Quote["status"];
  hasConfirmation: boolean;
  confirmationAvailabilityStatus?: string;
  hotelOptions: PublicQuoteHotelOptionDTO[];
};

export function toPublicQuoteDTO(quote: Quote): PublicQuoteDTO {
  return {
    id: quote.id,
    code: quote.code,
    token: quote.token,
    publicShortCode: quote.publicShortCode,
    customerFirstName: quote.customerFirstName,
    customerLastName: quote.customerLastName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    requestedHotel: quote.requestedHotel,
    isAlternative: quote.isAlternative,
    arrivalDate: quote.arrivalDate,
    departureDate: quote.departureDate,
    adults: quote.adults,
    children: quote.children.map((child) => ({
      id: child.id,
      age: child.age,
    })),
    rooms: quote.rooms,
    offerExpiresAt: quote.offerExpiresAt,
    customerNotes: quote.customerNotes,
    status: quote.status,
    hasConfirmation: Boolean(quote.confirmation),
    confirmationAvailabilityStatus: quote.confirmation?.availabilityStatus,
    hotelOptions: getEffectiveHotelOptions(quote).map((option) => ({
      id: option.id,
      hotelGroup: option.hotelGroup,
      badge: option.badge,
      hotelReason: option.hotelReason,
      roomTypeLabel: option.roomTypeLabel,
      hotelName: option.hotelName,
      hotelLocation: option.hotelLocation,
      hotelStars: option.hotelStars,
      hotelImageUrl: option.hotelImageUrl,
      sourceUrl: option.sourceUrl,
      breakfastDetails: option.breakfastDetails,
      halfBoardDetails: option.halfBoardDetails,
      fullBoardDetails: option.fullBoardDetails,
      includedServices: option.includedServices,
      depositPercent: option.depositPercent,
      balanceMethod: option.balanceMethod,
      paymentPolicy: option.paymentPolicy,
      cancellationPolicy: option.cancellationPolicy,
      paymentNotes: option.paymentNotes,
      notes: option.notes,
      commitmentNote: option.commitmentNote,
      isSelected: option.isSelected,
      treatments: option.treatments.map((treatment) => ({
        key: treatment.key,
        label: treatment.label,
        price: treatment.price,
      })),
    })),
  };
}
