export const BUSINESS_CONTACT_SETTINGS_KEY = "business_contact_settings";

export type BusinessContactSettings = {
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  updatedAt?: string;
};

export const defaultBusinessContactSettings: BusinessContactSettings = {
  phone: "081 90 54 81",
  whatsapp: "371 75 90 017",
  email: "info@ischiastars.it",
  website: "https://www.ischiastars.it"
};

export function normalizeBusinessContactSettings(value: unknown): BusinessContactSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    phone: typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : defaultBusinessContactSettings.phone,
    whatsapp: typeof raw.whatsapp === "string" && raw.whatsapp.trim() ? raw.whatsapp.trim() : defaultBusinessContactSettings.whatsapp,
    email: typeof raw.email === "string" && raw.email.trim() ? raw.email.trim() : defaultBusinessContactSettings.email,
    website: typeof raw.website === "string" && raw.website.trim() ? raw.website.trim() : defaultBusinessContactSettings.website,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}

export function businessContactSettingsToDbValue(settings: BusinessContactSettings) {
  return normalizeBusinessContactSettings(settings);
}
