export type PaymentAccountId = "primary" | "secondary";

export type PaymentAccount = {
  id: PaymentAccountId;
  label: string;
  bankAccountHolder: string;
  bankName: string;
  iban: string;
  bicSwift: string;
};

export type PaymentSettings = {
  primaryAccountLabel: string;
  bankAccountHolder: string;
  bankName: string;
  iban: string;
  bicSwift: string;
  secondaryAccountLabel: string;
  secondaryBankAccountHolder: string;
  secondaryBankName: string;
  secondaryIban: string;
  secondaryBicSwift: string;
  defaultPaymentAccount: PaymentAccountId;
  paymentReasonPrefix: string;
  paymentInstructions: string;
  acceptedBalanceMethods: string[];
  updatedAt: string;
};

export const PAYMENT_SETTINGS_KEY = "payment_settings";

export const emptyPaymentSettings: PaymentSettings = {
  primaryAccountLabel: "Conto 1",
  bankAccountHolder: "",
  bankName: "",
  iban: "",
  bicSwift: "",
  secondaryAccountLabel: "Conto 2",
  secondaryBankAccountHolder: "",
  secondaryBankName: "",
  secondaryIban: "",
  secondaryBicSwift: "",
  defaultPaymentAccount: "primary",
  paymentReasonPrefix: "Caparra soggiorno IschiaStars",
  paymentInstructions: "Inviare copia del pagamento tramite email o WhatsApp.",
  acceptedBalanceMethods: ["Carta", "Contanti"],
  updatedAt: ""
};

export function normalizePaymentSettings(value: unknown): PaymentSettings {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    primaryAccountLabel: stringValue(record.primary_account_label ?? record.primaryAccountLabel) || emptyPaymentSettings.primaryAccountLabel,
    bankAccountHolder: stringValue(record.bank_account_holder ?? record.bankAccountHolder),
    bankName: stringValue(record.bank_name ?? record.bankName),
    iban: normalizeIban(record.iban),
    bicSwift: stringValue(record.bic_swift ?? record.bicSwift).toUpperCase().trim(),
    secondaryAccountLabel: stringValue(record.secondary_account_label ?? record.secondaryAccountLabel) || emptyPaymentSettings.secondaryAccountLabel,
    secondaryBankAccountHolder: stringValue(record.secondary_bank_account_holder ?? record.secondaryBankAccountHolder),
    secondaryBankName: stringValue(record.secondary_bank_name ?? record.secondaryBankName),
    secondaryIban: normalizeIban(record.secondary_iban ?? record.secondaryIban),
    secondaryBicSwift: stringValue(record.secondary_bic_swift ?? record.secondaryBicSwift).toUpperCase().trim(),
    defaultPaymentAccount: (record.default_payment_account ?? record.defaultPaymentAccount) === "secondary" ? "secondary" : "primary",
    paymentReasonPrefix: stringValue(record.payment_reason_prefix ?? record.paymentReasonPrefix) || emptyPaymentSettings.paymentReasonPrefix,
    paymentInstructions: stringValue(record.payment_instructions ?? record.paymentInstructions) || emptyPaymentSettings.paymentInstructions,
    acceptedBalanceMethods: arrayValue(record.accepted_balance_methods ?? record.acceptedBalanceMethods),
    updatedAt: stringValue(record.updated_at ?? record.updatedAt)
  };
}

export function paymentSettingsToDbValue(settings: PaymentSettings) {
  return {
    primary_account_label: settings.primaryAccountLabel.trim() || emptyPaymentSettings.primaryAccountLabel,
    bank_account_holder: settings.bankAccountHolder.trim(),
    bank_name: settings.bankName.trim(),
    iban: settings.iban.trim().toUpperCase(),
    bic_swift: settings.bicSwift.trim().toUpperCase(),
    secondary_account_label: settings.secondaryAccountLabel.trim() || emptyPaymentSettings.secondaryAccountLabel,
    secondary_bank_account_holder: settings.secondaryBankAccountHolder.trim(),
    secondary_bank_name: settings.secondaryBankName.trim(),
    secondary_iban: settings.secondaryIban.trim().toUpperCase(),
    secondary_bic_swift: settings.secondaryBicSwift.trim().toUpperCase(),
    default_payment_account: settings.defaultPaymentAccount,
    payment_reason_prefix: settings.paymentReasonPrefix.trim(),
    payment_instructions: settings.paymentInstructions.trim(),
    accepted_balance_methods: settings.acceptedBalanceMethods.map((item) => item.trim()).filter(Boolean),
    updated_at: settings.updatedAt || new Date().toISOString()
  };
}

export function paymentAccount(settings: PaymentSettings, accountId: PaymentAccountId): PaymentAccount {
  if (accountId === "secondary") {
    return {
      id: "secondary",
      label: settings.secondaryAccountLabel.trim() || emptyPaymentSettings.secondaryAccountLabel,
      bankAccountHolder: settings.secondaryBankAccountHolder,
      bankName: settings.secondaryBankName,
      iban: settings.secondaryIban,
      bicSwift: settings.secondaryBicSwift
    };
  }

  return {
    id: "primary",
    label: settings.primaryAccountLabel.trim() || emptyPaymentSettings.primaryAccountLabel,
    bankAccountHolder: settings.bankAccountHolder,
    bankName: settings.bankName,
    iban: settings.iban,
    bicSwift: settings.bicSwift
  };
}

export function paymentSettingsForAccount(settings: PaymentSettings, accountId: PaymentAccountId): PaymentSettings {
  const account = paymentAccount(settings, accountId);
  return {
    ...settings,
    bankAccountHolder: account.bankAccountHolder,
    bankName: account.bankName,
    iban: account.iban,
    bicSwift: account.bicSwift
  };
}

export function isPaymentAccountConfigured(settings: PaymentSettings, accountId: PaymentAccountId) {
  const account = paymentAccount(settings, accountId);
  return Boolean(account.bankAccountHolder.trim() && account.iban.trim());
}

export function isPaymentSettingsConfigured(settings: PaymentSettings) {
  return isPaymentAccountConfigured(settings, "primary") || isPaymentAccountConfigured(settings, "secondary");
}

export function configuredPaymentAccounts(settings: PaymentSettings) {
  return (["primary", "secondary"] as PaymentAccountId[])
    .map((id) => paymentAccount(settings, id))
    .filter((account) => account.bankAccountHolder.trim() && account.iban.trim());
}

export function buildPaymentReason(settings: PaymentSettings, quoteCode: string, firstName: string, lastName: string) {
  const clientName = [lastName, firstName].map((value) => value.trim()).filter(Boolean).join(" ");
  return [settings.paymentReasonPrefix || emptyPaymentSettings.paymentReasonPrefix, `Preventivo ${quoteCode}`, clientName].filter(Boolean).join(" - ");
}

export function buildBalancePaymentReason(settings: PaymentSettings, quoteCode: string, firstName: string, lastName: string) {
  const prefix = settings.paymentReasonPrefix || emptyPaymentSettings.paymentReasonPrefix;
  const balancePrefix = /^caparra\b/i.test(prefix)
    ? prefix.replace(/^caparra\b/i, "Saldo")
    : "Saldo soggiorno IschiaStars";
  return buildPaymentReason({ ...settings, paymentReasonPrefix: balancePrefix }, quoteCode, firstName, lastName);
}

export function validateIbanLight(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!compact) return null;
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(compact)) return "IBAN non sembra valido: controlla lunghezza e caratteri.";
  return null;
}

function normalizeIban(value: unknown) {
  return stringValue(value).toUpperCase().replace(/\s+/g, " ").trim();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown) {
  if (!Array.isArray(value)) return emptyPaymentSettings.acceptedBalanceMethods;
  const items = value.map((item) => stringValue(item)).filter(Boolean);
  return items.length ? items : emptyPaymentSettings.acceptedBalanceMethods;
}
