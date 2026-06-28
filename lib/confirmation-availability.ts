import { ConfirmationAvailabilityStatus } from "@/lib/types";

export const availabilityStatusLabels: Record<ConfirmationAvailabilityStatus, string> = {
  availability_to_check: "Da verificare con struttura",
  availability_confirmed: "Disponibilità struttura confermata",
  final_confirmation_sent: "Conferma definitiva inviata",
  deposit_waiting: "In attesa caparra",
  availability_unavailable: "Disponibilità terminata",
  alternative_to_propose: "Alternativa da proporre"
};

export function availabilityStatusLabel(status?: string) {
  return availabilityStatusLabels[(status as ConfirmationAvailabilityStatus) || "availability_to_check"] ?? availabilityStatusLabels.availability_to_check;
}

export function defaultDepositDueAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

export function defaultDepositDueAtForArrival(arrivalDate?: string) {
  if (!arrivalDate) return defaultDepositDueAt();
  const dateOnlyMatch = arrivalDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnlyMatch
    ? new Date(Date.UTC(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 21, 59, 0, 0))
    : new Date(arrivalDate);
  if (Number.isNaN(date.getTime())) return defaultDepositDueAt();
  date.setUTCDate(date.getUTCDate() - 14);
  return date;
}

export function formatDepositDueLocalInput(date = defaultDepositDueAt()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function depositCoordinatesWhatsappMessage(input: {
  firstName: string;
  code: string;
  hotelName: string;
  arrivalDate: string;
  departureDate: string;
  roomLabel?: string;
  treatmentLabel: string;
  priceLabel: string;
  depositLabel: string;
  balanceLabel?: string;
  balanceDueLabel?: string;
  balanceInStructure?: boolean;
  bankAccountHolder: string;
  bankName?: string;
  iban: string;
  bicSwift?: string;
  paymentReason: string;
  paymentInstructions?: string;
}) {
  const {
    firstName, code, hotelName, arrivalDate, departureDate, roomLabel, treatmentLabel, priceLabel,
    depositLabel, balanceLabel, balanceDueLabel, balanceInStructure,
    bankAccountHolder, bankName, iban, bicSwift, paymentReason
  } = input;
  const stayDetails = splitStayDetails(treatmentLabel, roomLabel);
  const formattedFirstName = formatFirstName(firstName);
  const formattedBankName = formatBankName(bankName);
  const balanceSentence = balanceLabel
    ? balanceDueLabel
      ? `Il saldo restante di *${balanceLabel}* dovrà essere versato entro il *${balanceDueLabel}*.`
      : balanceInStructure
        ? `Il saldo restante di *${balanceLabel}* dovrà essere versato in struttura.`
        : `Il saldo restante è di *${balanceLabel}*.`
    : "";

  return `Ciao ${formattedFirstName} 👋

Ottime notizie: la disponibilità per la tua proposta *${code}* è stata confermata dalla struttura *${hotelName}*.

*Dettagli soggiorno*
📅 Dal *${formatDateRome(arrivalDate)}* al *${formatDateRome(departureDate)}*
🏨 *${hotelName}*
${stayDetails.room ? `🛏️ ${stayDetails.room}\n` : ""}🍽️ ${stayDetails.treatment}
💰 Totale soggiorno: *${priceLabel}*

Per bloccare la prenotazione è richiesto un acconto di *${depositLabel}*.
${balanceSentence ? `\n${balanceSentence}\n` : ""}
💳 *Coordinate per il bonifico*
Intestatario: *${bankAccountHolder}*
${formattedBankName ? `Banca: *${formattedBankName}*\n` : ""}IBAN: *${iban}*
Nota: la quinta lettera dell’IBAN è la *I di Imola*.
${bicSwift ? `BIC/SWIFT: *${bicSwift}*\n` : ""}
*Causale:*
${paymentReason}

Ti chiediamo gentilmente di inviare copia del pagamento tramite email o WhatsApp.

Appena ricevuto l’acconto, ti invieremo la conferma definitiva della prenotazione.

Per qualsiasi dubbio puoi scriverci qui su WhatsApp.

IschiaStars 🌊`;
}

function splitStayDetails(treatmentLabel: string, roomLabel?: string) {
  const cleaned = treatmentLabel.trim();
  const firstRoomMatch = cleaned.match(/^Camera\s+\d+:\s*([^,;]+),\s*([^;]+)(?:;|$)/i);
  if (!firstRoomMatch) {
    return {
      room: roomLabel?.trim(),
      treatment: cleaned
    };
  }
  return {
    room: roomLabel?.trim() || firstRoomMatch[1].trim(),
    treatment: firstRoomMatch[2].trim()
  };
}

function formatFirstName(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "Cliente";
  return cleaned.charAt(0).toLocaleUpperCase("it-IT") + cleaned.slice(1).toLocaleLowerCase("it-IT");
}

function formatBankName(value?: string) {
  const cleaned = value?.trim();
  if (!cleaned) return undefined;
  return cleaned.replace(/\bIntesa\s+San\s+Paolo\b/i, "Intesa Sanpaolo");
}

function formatDateRome(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function defaultUnavailabilityMessage(firstName: string, code: string) {
  return `Ciao ${firstName || "Cliente"},

ti ringraziamo per aver confermato la proposta.

Abbiamo verificato la disponibilità con la struttura selezionata, ma purtroppo al momento la disponibilità per questa soluzione è terminata.

Ci dispiace per l'inconveniente.

Stiamo verificando una soluzione alternativa il più possibile vicina alla tua richiesta e ti aggiorneremo appena disponibile.

Per qualsiasi dubbio puoi rispondere a questa email o scriverci su WhatsApp.

IschiaStars`;
}
