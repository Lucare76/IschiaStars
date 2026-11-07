/**
 * Preparatory Meta Conversions API adapter. NOT connected to live booking flows.
 * Enable only after privacy/consent, attribution, deduplication and event ledger review.
 * Never expose META_CAPI_ACCESS_TOKEN to client code.
 */
import { createHash } from "node:crypto";

export type MetaBookingEvent = {
  confirmationId: string;
  occurredAt: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  fbp?: string;
  fbc?: string;
  consentGranted: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, "");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function buildMetaBookingPayload(event: MetaBookingEvent) {
  if (!event.consentGranted) return null;
  if (!event.confirmationId || !Number.isFinite(Date.parse(event.occurredAt))) {
    throw new Error("Invalid confirmation identifier or timestamp");
  }
  const user_data: Record<string, string | string[]> = {};
  if (event.email) user_data.em = [hash(normalizeEmail(event.email))];
  if (event.phone) user_data.ph = [hash(normalizePhone(event.phone))];
  if (event.fbp) user_data.fbp = event.fbp;
  if (event.fbc) user_data.fbc = event.fbc;
  if (!Object.keys(user_data).length) return null;

  return {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.parse(event.occurredAt) / 1000),
      event_id: `ischiastars-booking-${event.confirmationId}`,
      action_source: "website",
      user_data,
      ...(event.value !== undefined && Number.isFinite(event.value) && event.value >= 0
        ? { custom_data: { currency: event.currency ?? "EUR", value: event.value } }
        : {})
    }]
  };
}

/** Deliberately disabled. Sending needs a durable outbox + consent and source verification. */
export function isMetaBookingIntegrationEnabled() {
  return process.env.META_BOOKING_CAPI_ENABLED === "true"
    && Boolean(process.env.META_CAPI_PIXEL_ID)
    && Boolean(process.env.META_CAPI_ACCESS_TOKEN);
}
