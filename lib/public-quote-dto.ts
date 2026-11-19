import { missingEnglishTranslations, requireEnglishText } from "@/lib/i18n/quote-language";
import { getQuoteCostBreakdown } from "@/lib/confirmation-additional-services";
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
  roomImageUrl?: string;
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
  language?: "it" | "en";
  englishReady?: boolean;
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
  costBreakdown?: ReturnType<typeof getQuoteCostBreakdown>;
  hasConfirmation: boolean;
  confirmationAvailabilityStatus?: string;
  hotelOptions: PublicQuoteHotelOptionDTO[];
};

export function toPublicQuoteDTO(quote: Quote): PublicQuoteDTO {
  const dto: PublicQuoteDTO = {
    language: quote.language ?? "it",
    englishReady: quote.language !== "en" || missingEnglishTranslations(quote).length === 0,
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
    costBreakdown: getQuoteCostBreakdown(quote),
    hasConfirmation: Boolean(quote.confirmation),
    confirmationAvailabilityStatus: quote.confirmation?.availabilityStatus,
    hotelOptions: getEffectiveHotelOptions(quote).map((option) => ({
      id: option.id,
      hotelGroup: option.hotelGroup,
      badge: option.badge,
      hotelReason: option.hotelReason,
      roomTypeLabel: option.roomTypeLabel,
      roomImageUrl: option.roomImageUrl,
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
  if (quote.language !== "en" || !dto.englishReady) return dto;
  const t = (value?: string | null) => requireEnglishText(quote, value);
  dto.customerNotes = t(dto.customerNotes);
  dto.hotelOptions = dto.hotelOptions.map(option => ({ ...option,
    hotelReason: t(option.hotelReason), roomTypeLabel: t(option.roomTypeLabel),
    breakfastDetails: t(option.breakfastDetails), halfBoardDetails: t(option.halfBoardDetails), fullBoardDetails: t(option.fullBoardDetails),
    includedServices: t(option.includedServices), balanceMethod: t(option.balanceMethod), paymentPolicy: t(option.paymentPolicy),
    cancellationPolicy: t(option.cancellationPolicy), paymentNotes: t(option.paymentNotes), notes: t(option.notes), commitmentNote: t(option.commitmentNote),
    treatments: option.treatments.map(treatment => ({ ...treatment, label: t(treatment.label) }))
  }));
  if (dto.costBreakdown) dto.costBreakdown.services = dto.costBreakdown.services.map(service => ({...service, label:t(service.label)}));
  return dto;
}
