"use client";

import { PrintButton } from "@/components/PrintButton";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { publicQuoteConfirmOrInfoWhatsappMessage, publicQuoteInfoWhatsappMessage } from "@/lib/message-templates";
import { Quote } from "@/lib/types";
import { absolutePublicQuoteUrl, publicWhatsappLink } from "@/lib/utils";

export function PublicQuoteHeaderActions({ quote }: { quote: Quote }) {
  const quoteUrl = absolutePublicQuoteUrl(quote);
  return (
    <div className="flex flex-wrap gap-2">
      <a
        className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white"
        href={publicWhatsappLink(publicQuoteInfoWhatsappMessage(quote, quoteUrl))}
        onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "public_header" })}
      >
        WhatsApp
      </a>
      <PrintButton className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white" quoteCode={quote.code} token={quote.token} />
    </div>
  );
}

export function PublicQuoteMainActions({ quote }: { quote: Quote }) {
  const quoteUrl = absolutePublicQuoteUrl(quote);
  return (
    <div className="no-print grid gap-3 rounded-2xl bg-white p-5 shadow-soft">
      <a
        className="rounded-full bg-ischia-leaf px-5 py-3 text-center font-black text-white"
        href={publicWhatsappLink(publicQuoteConfirmOrInfoWhatsappMessage(quote, quoteUrl))}
        onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "public_offer_card" })}
      >
        Hai domande? Scrivici su WhatsApp
      </a>
      <a className="rounded-full bg-ischia-sun px-5 py-3 text-center font-black text-ischia-navy" href="#conferma" onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "confirm_clicked", { placement: "public_offer_card" })}>
        Conferma il preventivo
      </a>
      <PrintButton quoteCode={quote.code} token={quote.token} />
    </div>
  );
}

export function MobileFloatingWhatsApp({ quote }: { quote: Quote }) {
  const quoteUrl = absolutePublicQuoteUrl(quote);
  return (
    <a
      className="no-print fixed bottom-3 left-3 right-3 z-20 rounded-full bg-ischia-leaf px-5 py-3 text-center text-sm font-black text-white shadow-soft sm:hidden"
      href={publicWhatsappLink(publicQuoteInfoWhatsappMessage(quote, quoteUrl))}
      onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "mobile_sticky" })}
    >
      Hai domande? WhatsApp
    </a>
  );
}
