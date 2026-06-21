export const RELIABLE_QUOTE_TRACKING_FROM = "2026-06-19T16:55:52.000Z";

const HOUR_MS = 60 * 60 * 1000;

export type FollowUpStage = "recente" | "primo_sollecito" | "secondo_sollecito" | "ultimo_contatto";

export function hasReliableQuoteTracking(sentAt: string) {
  const timestamp = new Date(sentAt).getTime();
  return Number.isFinite(timestamp) && timestamp >= new Date(RELIABLE_QUOTE_TRACKING_FROM).getTime();
}

export function followUpStage(sentAt: string, now = Date.now()): FollowUpStage {
  const hours = (now - new Date(sentAt).getTime()) / HOUR_MS;
  if (hours < 24) return "recente";
  if (hours < 72) return "primo_sollecito";
  if (hours < 168) return "secondo_sollecito";
  return "ultimo_contatto";
}

export function followUpStageLabel(stage: FollowUpStage) {
  const labels: Record<FollowUpStage, string> = {
    recente: "Inviato da poco",
    primo_sollecito: "Primo sollecito",
    secondo_sollecito: "Secondo sollecito",
    ultimo_contatto: "Ultimo contatto"
  };
  return labels[stage];
}

export function isFollowUpStageDue(sentAt: string, lastContactAt?: string, now = Date.now()) {
  const sentTimestamp = new Date(sentAt).getTime();
  if (!Number.isFinite(sentTimestamp)) return false;
  const stage = followUpStage(sentAt, now);
  if (stage === "recente") return false;
  const stageOffsetHours = stage === "primo_sollecito" ? 24 : stage === "secondo_sollecito" ? 72 : 168;
  const stageStartedAt = sentTimestamp + stageOffsetHours * HOUR_MS;
  const lastContactTimestamp = lastContactAt ? new Date(lastContactAt).getTime() : 0;
  return !Number.isFinite(lastContactTimestamp) || lastContactTimestamp < stageStartedAt;
}

export function followUpCustomerKey(customer: {
  customerPhone?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientName?: string;
}) {
  const phone = (customer.customerPhone ?? customer.clientPhone ?? "").replace(/\D/g, "");
  if (phone.length >= 8) return `phone:${phone}`;
  const email = (customer.customerEmail ?? customer.clientEmail ?? "").trim().toLowerCase();
  if (email && !["info@ischiastars.it", "preventivi@ischiastars.it"].includes(email)) return `email:${email}`;
  const name = customer.clientName
    ?? [customer.customerFirstName, customer.customerLastName].filter(Boolean).join(" ");
  return name.trim().toLowerCase() ? `name:${name.trim().toLowerCase()}` : "";
}
