export type FeatureFlagKey = "wow6_adaptive" | "closing_message" | "instant_reaction" | "alternative_proposal";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const FEATURE_FLAGS_KEY = "feature_flags";

export const FEATURE_FLAG_DEFINITIONS: { key: FeatureFlagKey; label: string; description: string }[] = [
  {
    key: "wow6_adaptive",
    label: "wow6_adaptive",
    description: "Versione adattiva della sezione Wow 6 del preventivo (in sviluppo, non ancora visibile al cliente)."
  },
  {
    key: "closing_message",
    label: "closing_message",
    description: "Messaggio di chiusura personalizzato a fine preventivo (in sviluppo, non ancora visibile al cliente)."
  },
  {
    key: "instant_reaction",
    label: "instant_reaction",
    description: "Reazioni immediate del cliente sulle proposte hotel (in sviluppo, non ancora visibile al cliente)."
  },
  {
    key: "alternative_proposal",
    label: "alternative_proposal",
    description: "Proposta alternativa automatica quando l'hotel richiesto non è disponibile (in sviluppo, non ancora visibile al cliente)."
  }
];

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = FEATURE_FLAG_DEFINITIONS.map((definition) => definition.key);

export const emptyFeatureFlags: FeatureFlags = {
  wow6_adaptive: false,
  closing_message: false,
  instant_reaction: false,
  alternative_proposal: false
};

export function isFeatureFlagKey(value: unknown): value is FeatureFlagKey {
  return typeof value === "string" && (FEATURE_FLAG_KEYS as string[]).includes(value);
}

export function normalizeFeatureFlags(value: unknown): FeatureFlags {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    wow6_adaptive: Boolean(record.wow6_adaptive),
    closing_message: Boolean(record.closing_message),
    instant_reaction: Boolean(record.instant_reaction),
    alternative_proposal: Boolean(record.alternative_proposal)
  };
}
