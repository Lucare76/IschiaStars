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

export function formatDepositDueLocalInput(date = defaultDepositDueAt()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function depositCoordinatesWhatsappMessage(input: {
  firstName: string;
  code: string;
  hotelName: string;
  treatmentLabel: string;
  priceLabel: string;
  depositLabel: string;
  balanceLabel?: string;
  depositDueLabel?: string;
  bankAccountHolder: string;
  bankName?: string;
  iban: string;
  bicSwift?: string;
  paymentReason: string;
  paymentInstructions?: string;
}) {
  const {
    firstName, code, hotelName, treatmentLabel, priceLabel,
    depositLabel, balanceLabel, depositDueLabel,
    bankAccountHolder, bankName, iban, bicSwift, paymentReason, paymentInstructions
  } = input;

  return `Ciao ${firstName || "Cliente"} 👋

Ottime notizie: la disponibilità per la tua proposta ${code} è stata confermata dalla struttura ${hotelName} (${treatmentLabel}, ${priceLabel}).

Per bloccare la prenotazione ti chiediamo un acconto di ${depositLabel}${balanceLabel ? `, saldo di ${balanceLabel} da versare in struttura` : ""}${depositDueLabel ? `, entro il ${depositDueLabel}` : ""}.

💳 Coordinate per il bonifico:
Intestatario: ${bankAccountHolder}
${bankName ? `Banca: ${bankName}\n` : ""}IBAN: ${iban}
${bicSwift ? `BIC/SWIFT: ${bicSwift}\n` : ""}Causale: ${paymentReason}
${paymentInstructions ? `\n${paymentInstructions}` : ""}

Appena ricevuto l'acconto ti confermiamo definitivamente la prenotazione. Per qualsiasi dubbio scrivici pure qui su WhatsApp.

IschiaStars 🌊`;
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
