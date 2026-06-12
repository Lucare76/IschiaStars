import { isIP } from "node:net";
import type { QuoteEvent } from "@/lib/types";

const DEFAULT_EXCLUDED_IPS = ["93.148.93.103"];

export const CUSTOMER_ACTIVITY_EVENT_TYPES: QuoteEvent["eventType"][] = [
  "quote_opened", "whatsapp_clicked", "confirm_clicked", "quote_confirmed",
  "print_clicked", "hotel_link_clicked", "details_opened", "compare_opened",
  "reveal_options_clicked", "hesitant_whatsapp_clicked", "reaction_interested",
  "reaction_too_expensive"
];

export function getTrackingExcludedIps() {
  const configured = (process.env.TRACKING_EXCLUDED_IPS ?? "")
    .split(",")
    .map(normalizeIp)
    .filter((ip): ip is string => Boolean(ip));

  return Array.from(new Set([...DEFAULT_EXCLUDED_IPS, ...configured]));
}

export function getRequestIp(headers: Headers) {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip")
  ];

  for (const candidate of candidates) {
    for (const value of candidate?.split(",") ?? []) {
      const ip = normalizeIp(value);
      if (ip) return ip;
    }
  }

  return undefined;
}

export function isTrackingExcludedIp(ip: string | undefined) {
  return Boolean(ip && getTrackingExcludedIps().includes(ip));
}

export function isExcludedTrackingEvent(event: Pick<QuoteEvent, "metadata">) {
  const metadata = event.metadata ?? {};
  const ip = typeof metadata.ip === "string" ? normalizeIp(metadata.ip) : undefined;
  return metadata.excluded_from_tracking === true || metadata.excluded_from_tracking === "true" || isTrackingExcludedIp(ip);
}

export function isCustomerActivityEvent(event: QuoteEvent) {
  if (!CUSTOMER_ACTIVITY_EVENT_TYPES.includes(event.eventType) || isExcludedTrackingEvent(event)) return false;
  const placement = typeof event.metadata?.placement === "string" ? event.metadata.placement : "";
  const source = typeof event.metadata?.source === "string" ? event.metadata.source : "";
  return placement !== "admin_quote_card" && !source.startsWith("admin_") && !source.startsWith("supervisor_");
}

function normalizeIp(value: string | undefined) {
  let candidate = value?.trim().replace(/^"|"$/g, "");
  if (!candidate) return undefined;

  if (candidate.startsWith("[")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) candidate = candidate.slice(7);
  return isIP(candidate) ? candidate.toLowerCase() : undefined;
}
