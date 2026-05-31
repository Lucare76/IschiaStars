export type PaymentSettings = {
  bankAccountHolder: string;
  bankName: string;
  iban: string;
  bicSwift: string;
  paymentReasonPrefix: string;
  paymentInstructions: string;
  acceptedBalanceMethods: string[];
  updatedAt: string;
};

export const PAYMENT_SETTINGS_KEY = "payment_settings";

export const emptyPaymentSettings: PaymentSettings = {
  bankAccountHolder: "",
  bankName: "",
  iban: "",
  bicSwift: "",
  paymentReasonPrefix: "Caparra soggiorno IschiaStars",
  paymentInstructions: "Inviare copia del pagamento tramite email o WhatsApp.",
  acceptedBalanceMethods: ["Carta", "Contanti"],
  updatedAt: ""
};

export function normalizePaymentSettings(value: unknown): PaymentSettings {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    bankAccountHolder: stringValue(record.bank_account_holder ?? record.bankAccountHolder),
    bankName: stringValue(record.bank_name ?? record.bankName),
    iban: stringValue(record.iban).toUpperCase().replace(/\s+/g, " ").trim(),
    bicSwift: stringValue(record.bic_swift ?? record.bicSwift).toUpperCase().trim(),
    paymentReasonPrefix: stringValue(record.payment_reason_prefix ?? record.paymentReasonPrefix) || emptyPaymentSettings.paymentReasonPrefix,
    paymentInstructions: stringValue(record.payment_instructions ?? record.paymentInstructions) || emptyPaymentSettings.paymentInstructions,
    acceptedBalanceMethods: arrayValue(record.accepted_balance_methods ?? record.acceptedBalanceMethods),
    updatedAt: stringValue(record.updated_at ?? record.updatedAt)
  };
}

export function paymentSettingsToDbValue(settings: PaymentSettings) {
  return {
    bank_account_holder: settings.bankAccountHolder.trim(),
    bank_name: settings.bankName.trim(),
    iban: settings.iban.trim().toUpperCase(),
    bic_swift: settings.bicSwift.trim().toUpperCase(),
    payment_reason_prefix: settings.paymentReasonPrefix.trim(),
    payment_instructions: settings.paymentInstructions.trim(),
    accepted_balance_methods: settings.acceptedBalanceMethods.map((item) => item.trim()).filter(Boolean),
    updated_at: settings.updatedAt || new Date().toISOString()
  };
}

export function isPaymentSettingsConfigured(settings: PaymentSettings) {
  return Boolean(settings.bankAccountHolder.trim() && settings.iban.trim());
}

export function buildPaymentReason(settings: PaymentSettings, quoteCode: string, firstName: string, lastName: string) {
  const clientName = [lastName, firstName].map((value) => value.trim()).filter(Boolean).join(" ");
  return [settings.paymentReasonPrefix || emptyPaymentSettings.paymentReasonPrefix, `Preventivo ${quoteCode}`, clientName].filter(Boolean).join(" - ");
}

export function validateIbanLight(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!compact) return null;
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(compact)) return "IBAN non sembra valido: controlla lunghezza e caratteri.";
  return null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown) {
  if (!Array.isArray(value)) return emptyPaymentSettings.acceptedBalanceMethods;
  const items = value.map((item) => stringValue(item)).filter(Boolean);
  return items.length ? items : emptyPaymentSettings.acceptedBalanceMethods;
}
