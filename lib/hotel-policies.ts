export type HotelPolicyDefaults = {
  depositPercent: number;
  balanceMethod: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  paymentNotes: string;
  cancellationDays: 7 | 14;
};

export type PaymentBreakdown = {
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  balanceMethod: string;
};

export const BALANCE_METHOD_IN_STRUCTURE = "Saldo restante in struttura con carta o contanti.";

export const CANCELLATION_POLICY_14_DAYS =
  "La cancellazione o modifica della prenotazione è consentita senza penale entro 14 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.";

export const CANCELLATION_POLICY_7_DAYS =
  "La cancellazione o modifica della prenotazione è consentita senza penale entro 7 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.";

const PAYMENT_POLICY_TEMPLATE = (percent: number) =>
  `Acconto ${percent}% alla conferma. ${BALANCE_METHOD_IN_STRUCTURE}`;

const GROUP_A = ["felix", "royal", "alexander"];
const GROUP_B = ["re ferdinando", "saint raphael", "president", "augusto", "pineta"];
const GROUP_C = ["castiglione village", "tramonto d oro"];

export function normalizeHotelPolicyName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(hotel|terme|resort|spa|villaggio)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDefaultHotelPoliciesByName(hotelName: string): HotelPolicyDefaults | null {
  const normalized = normalizeHotelPolicyName(hotelName);
  if (!normalized) return null;

  if (GROUP_A.some((name) => normalized.includes(name))) return buildDefaults(20, 14);
  if (GROUP_B.some((name) => normalized.includes(name))) return buildDefaults(15, 14);
  if (GROUP_C.some((name) => normalized.includes(name))) return buildDefaults(25, 7);

  return null;
}

export function fillMissingHotelPolicies(input: {
  hotelName: string;
  depositPercent?: number | null;
  balanceMethod?: string | null;
  paymentPolicy?: string | null;
  cancellationPolicy?: string | null;
  paymentNotes?: string | null;
}) {
  const defaults = getDefaultHotelPoliciesByName(input.hotelName);
  return {
    depositPercent: input.depositPercent ?? defaults?.depositPercent,
    balanceMethod: input.balanceMethod?.trim() || defaults?.balanceMethod || "",
    paymentPolicy: input.paymentPolicy?.trim() || defaults?.paymentPolicy || "",
    cancellationPolicy: input.cancellationPolicy?.trim() || defaults?.cancellationPolicy || "",
    paymentNotes: input.paymentNotes?.trim() || defaults?.paymentNotes || ""
  };
}

export function calculatePaymentBreakdown(price: number, depositPercent?: number | null, balanceMethod = BALANCE_METHOD_IN_STRUCTURE): PaymentBreakdown {
  const safePrice = Number.isFinite(price) ? Math.max(0, price) : 0;
  const safePercent = Number.isFinite(Number(depositPercent)) ? Math.max(0, Number(depositPercent)) : 0;
  const depositAmount = roundCurrency(safePrice * safePercent / 100);
  return {
    depositPercent: safePercent,
    depositAmount,
    balanceAmount: roundCurrency(safePrice - depositAmount),
    balanceMethod
  };
}

function buildDefaults(depositPercent: number, cancellationDays: 7 | 14): HotelPolicyDefaults {
  const cancellationPolicy = cancellationDays === 7 ? CANCELLATION_POLICY_7_DAYS : CANCELLATION_POLICY_14_DAYS;
  return {
    depositPercent,
    cancellationDays,
    balanceMethod: BALANCE_METHOD_IN_STRUCTURE,
    paymentPolicy: PAYMENT_POLICY_TEMPLATE(depositPercent),
    cancellationPolicy,
    paymentNotes: ""
  };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
