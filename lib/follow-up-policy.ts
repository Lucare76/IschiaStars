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
