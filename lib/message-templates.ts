import { Quote } from "@/lib/types";

export function adminQuoteWhatsappMessage(input: {
  quote: Quote;
  dates: string;
  hotelLine: string;
  quoteUrl: string;
  hasMultipleOptions: boolean;
}) {
  const { quote, dates, hotelLine, quoteUrl, hasMultipleOptions } = input;

  if (hasMultipleOptions) {
    return `Ciao ${quote.customerFirstName},
ho preparato la tua proposta con più soluzioni per il soggiorno a Ischia:

Date: ${dates}
Hotel: ${hotelLine}

${quoteUrl}

Puoi confrontare le opzioni e confermare online quella che preferisci.

Grazie,
IschiaStars`;
  }

  return `Ciao ${quote.customerFirstName},
ho preparato la tua proposta per il soggiorno a Ischia:

Date: ${dates}
Hotel: ${hotelLine}

${quoteUrl}

Puoi aprirla, vedere tutti i dettagli e confermare direttamente online.

Grazie,
IschiaStars`;
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
