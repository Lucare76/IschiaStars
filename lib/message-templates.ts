import { Quote } from "@/lib/types";

export function adminQuoteWhatsappMessage(input: {
  quote: Quote;
  dates: string;
  hotelLine: string;
  quoteUrl: string;
  hasMultipleOptions: boolean;
}) {
  const { quote, dates, hotelLine, quoteUrl, hasMultipleOptions } = input;

  const intro = hasMultipleOptions
    ? "Abbiamo selezionato per te più soluzioni per il soggiorno a Ischia:"
    : "Abbiamo selezionato per te una soluzione presso:";

  const linkLine = hasMultipleOptions
    ? "Dal link potrai confrontare le opzioni e confermare direttamente online quella che preferisci."
    : "Dal link potrai anche confermare direttamente online in modo semplice e veloce.";

  return `👋 Ciao ${quote.customerFirstName}!

La tua proposta personalizzata per Ischia è pronta 🌊

${intro}

🏨 ${hotelLine}
📅 ${dates}

Puoi vedere subito il preventivo completo, con tutti i dettagli del soggiorno, cliccando qui:

👉 ${quoteUrl}

${linkLine}

⚠️ Per questo periodo le disponibilità sono limitate: se la soluzione è di tuo gradimento, ti consigliamo di bloccarla appena possibile per mantenere la tariffa proposta.

Per dubbi, modifiche o richieste particolari puoi contattarci qui:

📞 081 90 54 81
💬 WhatsApp 371 75 90 017

A presto,
Diego - IschiaStars ☀️`;
}

export function publicQuoteInfoWhatsappMessage(quote: Quote, quoteUrl?: string) {
  return `Ciao IschiaStars, vorrei informazioni sul preventivo ${quote.code}${quoteUrl ? `: ${quoteUrl}` : ""}`;
}

export function publicQuoteConfirmOrInfoWhatsappMessage(quote: Quote, quoteUrl: string) {
  return `Ciao IschiaStars, vorrei confermare o chiedere info sul preventivo ${quote.code}: ${quoteUrl}`;
}

export function publicQuoteConfirmedWhatsappMessage(quote: Quote) {
  return `Ciao IschiaStars, ho confermato il preventivo ${quote.code}.`;
}
