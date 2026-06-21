export type HotelPolicyDefaults = {
  depositPercent: number;
  balanceMethod: string;
  paymentPolicy: string;
  cancellationPolicy: string;
  paymentNotes: string;
  cancellationDays: 7 | 14 | 20;
};

export type PaymentBreakdown = {
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  balanceMethod: string;
};

export const BALANCE_METHOD_IN_STRUCTURE = "Saldo restante in struttura con carta o contanti.";

export const BALANCE_METHOD_BONIFICO_14 = "Saldo entro 14 giorni dall’arrivo tramite bonifico bancario.";

export type BalancePaymentSchedule = {
  type: "in_structure" | "before_arrival" | "other";
  dueDate?: string;
  title: string;
};

export function getBalancePaymentSchedule(balanceMethod: string | undefined, arrivalDate: string): BalancePaymentSchedule {
  const method = balanceMethod?.trim() ?? "";
  const normalized = method.toLowerCase().replace(/[’']/g, "'");
  if (normalized.includes("in struttura")) {
    return { type: "in_structure", title: "Saldo da versare in struttura" };
  }
  if ((normalized.includes("14 giorni") || normalized.includes("14gg")) && normalized.includes("arrivo")) {
    return {
      type: "before_arrival",
      dueDate: subtractDaysFromDate(arrivalDate, 14),
      title: "Saldo da versare tramite bonifico"
    };
  }
  return { type: "other", title: "Saldo restante" };
}

export const CANCELLATION_POLICY_7_DAYS =
  "La cancellazione o modifica della prenotazione è consentita senza penale entro 7 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.";

export const CANCELLATION_POLICY_14_DAYS =
  "La cancellazione o modifica della prenotazione è consentita senza penale entro 14 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.";

export const CANCELLATION_POLICY_20_DAYS =
  "La cancellazione o modifica della prenotazione è consentita senza penale entro 20 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto, senza riduzioni per variazioni della durata del soggiorno o del numero di ospiti. I pasti non fruiti non danno diritto a rimborso.";

const PAYMENT_POLICY_TEMPLATE = (percent: number) =>
  `Acconto ${percent}% alla conferma. ${BALANCE_METHOD_IN_STRUCTURE}`;

const GROUP_A = ["felix", "royal", "alexander"];
const GROUP_B = ["re ferdinando", "saint raphael", "president", "augusto", "pineta"];
const GROUP_C = ["castiglione village", "tramonto d oro"];

// Group D: 30% deposit, saldo bonifico 14gg, cancellazione 20gg
// Checked BEFORE GROUP_B to avoid "pineta ischia" matching GROUP_B's "pineta".
const GROUP_D_30 = [
  "av club colella",       // AV CLUB Terme Colella
  "club thermal wellness", // Club Thermal Wellness Forio d'Ischia
  "roulette ischia porto", // Roulette Ischia Porto 4 ⭐
  "la villa",              // La Villa Resort & SPA
  "av isola verde",        // AV ISOLA VERDE – Hotel & Thermal SPA
  "villa teresa",          // Hotel Terme Villa Teresa
  "san lorenzo",           // Albergo Terme San Lorenzo
  "san giovanni",          // Hotel San Giovanni Terme
  "don pepe",              // Hotel Terme Don Pepe
  "san valentino",         // Hotel Terme San Valentino
  "la rosa",               // Hotel La Rosa
  "pineta ischia",         // Hotel Pineta Ischia (more specific than GROUP_B's "pineta")
  "regina palace",         // Hotel Regina Palace Terme
  "carlo magno",           // Park Hotel Carlo Magno
  "beccaccia",             // PARK HOTEL La Beccaccia
  "punto azzurro",         // Resort Punto Azzurro
];

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

  // GROUP_D checked before GROUP_B: "pineta ischia" is more specific than GROUP_B's "pineta"
  if (GROUP_D_30.some((name) => normalized.includes(name))) return buildBonificoDefaults(30);
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

function buildBonificoDefaults(depositPercent: number): HotelPolicyDefaults {
  return {
    depositPercent,
    cancellationDays: 20,
    balanceMethod: BALANCE_METHOD_BONIFICO_14,
    paymentPolicy: `Acconto del ${depositPercent}% e saldo entro 14 giorni dall'arrivo tramite bonifico bancario.`,
    cancellationPolicy: CANCELLATION_POLICY_20_DAYS,
    paymentNotes: "Saldo da effettuare tramite bonifico bancario entro 14 giorni dalla data di arrivo."
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

function subtractDaysFromDate(value: string, days: number) {
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return undefined;
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
