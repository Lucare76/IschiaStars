export const FOLLOW_UP_SETTINGS_KEY = "follow_up_settings";
export const FOLLOW_UP_SETTINGS_HISTORY_KEY = "follow_up_settings_history";
export const FOLLOW_UP_HISTORY_LIMIT = 12;

export type FollowUpTemplateKey =
  | "default"
  | "not_opened"
  | "opened"
  | "high_interest";

export type FollowUpTemplate = {
  key: FollowUpTemplateKey;
  label: string;
  enabled: boolean;
  message: string;
};

export type FollowUpEmailSettings = {
  enabled: boolean;
  subject: string;
  body: string;
  signature: string;
};

export type FollowUpSettings = {
  templates: FollowUpTemplate[];
  email: FollowUpEmailSettings;
  updatedAt?: string;
};

export type FollowUpSettingsHistoryEntry = {
  id: string;
  savedAt: string;
  settings: FollowUpSettings;
};

export const FOLLOW_UP_VARIABLES = [
  { token: "{nome}", label: "Nome cliente" },
  { token: "{codice}", label: "Codice preventivo" },
  { token: "{hotel}", label: "Hotel" },
  { token: "{arrivo}", label: "Arrivo" },
  { token: "{partenza}", label: "Partenza" },
  { token: "{prezzo}", label: "Prezzo" },
  { token: "{link_preventivo}", label: "Link preventivo" }
] as const;

export const defaultFollowUpSettings: FollowUpSettings = {
  templates: [
    {
      key: "default",
      label: "Follow-up standard",
      enabled: true,
      message: `Salve {nome},\nsolo un rapido promemoria: ha avuto modo di valutare la proposta per il suo soggiorno a Ischia?\n\nPuò rivedere il preventivo qui:\n{link_preventivo}\n\nSe Le interessa Le consiglio di confermare al più presto, perché la disponibilità è in continuo aggiornamento e potrebbe presto terminare.\n\nResto a disposizione! 🌴\nDiego`
    },
    {
      key: "not_opened",
      label: "Preventivo non visualizzato",
      enabled: true,
      message: `Salve {nome},\nvolevo assicurarmi che Le fosse arrivata correttamente la proposta per il soggiorno a Ischia.\n\nPuò aprirla qui:\n{link_preventivo}\n\nSe preferisce, ci contatti e La aiutiamo volentieri.\n\nDiego - IschiaStars ☀️`
    },
    {
      key: "opened",
      label: "Preventivo aperto",
      enabled: true,
      message: `Salve {nome},\nha avuto modo di vedere la proposta che Le abbiamo preparato?\n\nLa trova qui:\n{link_preventivo}\n\nSe ha dubbi su hotel, trattamento o disponibilità, mi scriva pure.\n\nDiego - IschiaStars ☀️`
    },
    {
      key: "high_interest",
      label: "Cliente molto interessato",
      enabled: true,
      message: `Salve {nome},\nho visto che ha consultato la proposta per il soggiorno a Ischia. Se vuole posso verificare nuovamente la disponibilità prima della conferma.\n\nPreventivo:\n{link_preventivo}\n\nResto a disposizione.\nDiego - IschiaStars ☀️`
    }
  ],
  email: {
    enabled: true,
    subject: "Promemoria proposta soggiorno a Ischia - {codice}",
    body: `Ciao {nome},\n\nvolevo sapere se hai avuto modo di valutare la proposta che ti abbiamo preparato per il soggiorno a Ischia.\n\nPuoi rivederla qui:\n{link_preventivo}\n\nSe vuoi possiamo verificare nuovamente disponibilità, hotel o trattamento prima della conferma.`,
    signature: "Diego\nIschiaStars"
  }
};

export function normalizeFollowUpSettings(value: unknown): FollowUpSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const incoming = Array.isArray(raw.templates) ? raw.templates : [];
  const rawEmail = raw.email && typeof raw.email === "object" ? raw.email as Record<string, unknown> : {};

  const templates = defaultFollowUpSettings.templates.map((fallback) => {
    const candidate = incoming.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).key === fallback.key) as Record<string, unknown> | undefined;
    if (!candidate) return fallback;
    return {
      key: fallback.key,
      label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : fallback.label,
      enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
      message: typeof candidate.message === "string" && candidate.message.trim() ? candidate.message : fallback.message
    };
  });

  return {
    templates,
    email: {
      enabled: typeof rawEmail.enabled === "boolean" ? rawEmail.enabled : defaultFollowUpSettings.email.enabled,
      subject: typeof rawEmail.subject === "string" && rawEmail.subject.trim() ? rawEmail.subject : defaultFollowUpSettings.email.subject,
      body: typeof rawEmail.body === "string" && rawEmail.body.trim() ? rawEmail.body : defaultFollowUpSettings.email.body,
      signature: typeof rawEmail.signature === "string" && rawEmail.signature.trim() ? rawEmail.signature : defaultFollowUpSettings.email.signature
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}

export function normalizeFollowUpSettingsHistory(value: unknown): FollowUpSettingsHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
      settings: normalizeFollowUpSettings(item.settings)
    }))
    .slice(0, FOLLOW_UP_HISTORY_LIMIT);
}

export function followUpSettingsToDbValue(settings: FollowUpSettings) {
  return normalizeFollowUpSettings(settings);
}

export function selectFollowUpTemplate(settings: FollowUpSettings, segment?: string) {
  const key: FollowUpTemplateKey = segment === "non_visualizzato"
    ? "not_opened"
    : segment === "molto_interessato"
      ? "high_interest"
      : segment === "aperto_non_confermato" || segment === "da_sollecitare"
        ? "opened"
        : "default";
  const preferred = settings.templates.find((item) => item.key === key && item.enabled);
  return preferred ?? settings.templates.find((item) => item.key === "default" && item.enabled) ?? defaultFollowUpSettings.templates[0];
}

export function renderFollowUpTemplate(message: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (output, [token, replacement]) => output.split(`{${token}}`).join(replacement ?? ""),
    message
  );
}
