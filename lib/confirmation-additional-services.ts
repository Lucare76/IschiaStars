import { formatCurrency } from "@/lib/utils";

export type ConfirmationAdditionalService = {
  label: string;
  cost?: number;
};

export function getConfirmationAdditionalServices(metadata: Record<string, unknown> | undefined): ConfirmationAdditionalService[] {
  if (!Array.isArray(metadata?.additional_services)) return [];

  return metadata.additional_services.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const cost = record.cost == null ? undefined : Number(record.cost);
    if (!label) return [];
    return [{ label, ...(Number.isFinite(cost) ? { cost } : {}) }];
  });
}

export function formatConfirmationAdditionalService(service: ConfirmationAdditionalService) {
  return service.cost != null ? `${service.label} (${formatCurrency(service.cost)})` : service.label;
}

// Service amounts are already included in the confirmed total.
export function getQuoteCostBreakdown(quote: { totalPrice: number; confirmation?: { selectedPrice?: number; metadata?: Record<string, unknown> } }) {
  const services = getConfirmationAdditionalServices(quote.confirmation?.metadata);
  if (!services.length) return null;
  const total = quote.confirmation?.selectedPrice ?? quote.totalPrice;
  const extrasTotal = Math.round(services.reduce((sum, service) => sum + (service.cost ?? 0), 0) * 100) / 100;
  const accommodation = Math.round((total - extrasTotal) * 100) / 100;
  if (!Number.isFinite(total) || services.some((service) => service.cost != null && service.cost < 0) || accommodation < 0) return null;
  return { total, accommodation, services, hasUnpricedServices: services.some((service) => service.cost == null) };
}
