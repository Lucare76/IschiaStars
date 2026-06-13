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
