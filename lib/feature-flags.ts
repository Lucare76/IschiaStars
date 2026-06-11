export type FeatureFlagKey = "wow6_adaptive" | "instant_reaction" | "alternative_proposal" | "voucher_cliente" | "supplier_confirmation" | "emailTravelServicesBox";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const FEATURE_FLAGS_KEY = "feature_flags";

export const FEATURE_FLAG_DEFINITIONS: { key: FeatureFlagKey; label: string; description: string }[] = [
  {
    key: "wow6_adaptive",
    label: "wow6_adaptive",
    description: "Preventivo adattivo: evidenzia hotel più visto dal cliente nelle sessioni precedenti"
  },
  {
    key: "instant_reaction",
    label: "instant_reaction",
    description: "Reazione istantanea: mi interessa / troppo caro su ogni proposta"
  },
  {
    key: "alternative_proposal",
    label: "alternative_proposal",
    description: "Proposta alternativa: box WhatsApp dopo 3+ aperture senza conferma"
  },
  {
    key: "voucher_cliente",
    label: "voucher_cliente",
    description: "Voucher PDF: bottone 'Caparra ricevuta' nel pannello conferma con invio voucher al cliente"
  },
  {
    key: "supplier_confirmation",
    label: "supplier_confirmation",
    description: "Conferma fornitore: bottone 'Invia conferma a hotel/agenzia' nel pannello conferma"
  },
  {
    key: "emailTravelServicesBox",
    label: "emailTravelServicesBox",
    description: "Box commerciale collegamenti: mostra le voci attive in fondo alle email preventivo cliente"
  }
];

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = FEATURE_FLAG_DEFINITIONS.map((definition) => definition.key);

export const emptyFeatureFlags: FeatureFlags = {
  wow6_adaptive: false,
  instant_reaction: false,
  alternative_proposal: false,
  voucher_cliente: false,
  supplier_confirmation: false,
  emailTravelServicesBox: false
};

export function isFeatureFlagKey(value: unknown): value is FeatureFlagKey {
  return typeof value === "string" && (FEATURE_FLAG_KEYS as string[]).includes(value);
}

export function normalizeFeatureFlags(value: unknown): FeatureFlags {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  return {
    wow6_adaptive: Boolean(record.wow6_adaptive),
    instant_reaction: Boolean(record.instant_reaction),
    alternative_proposal: Boolean(record.alternative_proposal),
    voucher_cliente: Boolean(record.voucher_cliente),
    supplier_confirmation: Boolean(record.supplier_confirmation),
    emailTravelServicesBox: Boolean(record.emailTravelServicesBox)
  };
}
