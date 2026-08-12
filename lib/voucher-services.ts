import { formatConfirmationAdditionalService, getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";

function normalizeService(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function treatmentServiceLabel(treatmentLabel?: string | null) {
  const normalized = normalizeService(treatmentLabel ?? "");
  if (normalized.includes("pensione completa")) return "Pensione completa inclusa";
  if (normalized.includes("mezza pensione")) return "Mezza pensione inclusa";
  if (normalized.includes("colazione")) return "Colazione inclusa";
  return null;
}

export function buildVoucherIncludedServices(input: {
  baseServices?: string[];
  selectedTreatmentLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const treatmentService = treatmentServiceLabel(input.selectedTreatmentLabel);
  const shouldRemoveBreakfastOnly = treatmentService === "Mezza pensione inclusa" || treatmentService === "Pensione completa inclusa";
  const services = (input.baseServices ?? [])
    .map((service) => service.trim())
    .filter(Boolean)
    .filter((service) => !(shouldRemoveBreakfastOnly && normalizeService(service) === "colazione inclusa"));

  if (treatmentService) services.push(treatmentService);
  services.push(...getConfirmationAdditionalServices(input.metadata).map(formatConfirmationAdditionalService));

  return Array.from(new Map(services.map((service) => [normalizeService(service), service])).values());
}
