import { createHash } from "node:crypto";

/** Draft only: does not transmit data to Meta or change booking workflows. */
export type BookingConversionInput = {
  confirmationId: string;
  paidAt: string;
  totalBookingValue: number;
  email?: string;
  phone?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
  advertisingConsent: {
    granted: boolean;
    capturedAt: string;
    purpose: "meta_ads_conversion";
    source: string;
  } | null;
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function prepareMetaBookingPurchase(input: BookingConversionInput) {
  const consent = input.advertisingConsent;
  if (!consent?.granted || consent.purpose !== "meta_ads_conversion" || !consent.source) return null;
  const paidAt = Date.parse(input.paidAt);
  const consentAt = Date.parse(consent.capturedAt);
  if (!Number.isFinite(paidAt) || !Number.isFinite(consentAt) || consentAt > paidAt) return null;
  if (!input.confirmationId.trim() || !Number.isFinite(input.totalBookingValue) || input.totalBookingValue <= 0) return null;

  const userData: Record<string, string> = {};
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.replace(/[^\d]/g, "");
  if (email) userData.em = hash(email);
  if (phone) userData.ph = hash(phone);
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (!Object.keys(userData).length) return null;

  return {
    event_name: "Purchase",
    event_time: Math.floor(paidAt / 1000),
    event_id: `booking-${input.confirmationId}`,
    action_source: "website",
    ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
    user_data: userData,
    custom_data: {
      currency: "EUR",
      value: input.totalBookingValue,
      order_id: input.confirmationId
    }
  };
}
