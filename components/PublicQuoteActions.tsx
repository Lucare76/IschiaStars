"use client";

import { PrintButton } from "@/components/PrintButton";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { publicQuoteConfirmOrInfoWhatsappMessage, publicQuoteInfoWhatsappMessage } from "@/lib/message-templates";
import type { PublicQuoteDTO } from "@/lib/public-quote-dto";
import { defaultQuoteContentSettings, type QuoteContentSettings } from "@/lib/quote-content-settings";
import { absolutePublicQuoteUrl, publicWhatsappLink } from "@/lib/utils";

export function PublicQuoteHeaderActions({ quote, contentSettings = defaultQuoteContentSettings }: { quote: PublicQuoteDTO; contentSettings?: QuoteContentSettings }) {
  const quoteUrl = absolutePublicQuoteUrl(quote);
  return (
    <div className="flex flex-wrap gap-2">
      <a
        className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white"
        href={publicWhatsappLink(publicQuoteInfoWhatsappMessage(quote, quoteUrl))}
        onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "public_header" })}
      >
        {contentSettings.headerWhatsappLabel}
      </a>
      <PrintButton className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white" quoteCode={quote.code} token={quote.token} />
    </div>
  );
}

export function PublicQuoteMainActions({ quote, contentSettings = defaultQuoteContentSettings }: { quote: PublicQuoteDTO; contentSettings?: QuoteContentSettings }) {
  const quoteUrl = absolutePublicQuoteUrl(quote);
  return (
    <div className="no-print grid gap-3 rounded-2xl bg-white p-5 shadow-soft">
      <a
        className="rounded-full bg-ischia-leaf px-5 py-3 text-center font-black text-white"
        href={publicWhatsappLink(publicQuoteConfirmOrInfoWhatsappMessage(quote, quoteUrl))}
        onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "public_offer_card" })}
      >
        {contentSettings.mainWhatsappLabel}
      </a>
      <a className="rounded-full bg-ischia-sun px-5 py-3 text-center font-black text-ischia-navy" href="#conferma" onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "confirm_clicked", { placement: "public_offer_card" })}>
        {contentSettings.mainConfirmLabel}
      </a>
      <PrintButton quoteCode={quote.code} token={quote.token} />
    </div>
  );
}

export function MobileFloatingWhatsApp({ quote, contentSettings = defaultQuoteContentSettings }: { quote: PublicQuoteDTO; contentSettings?: QuoteContentSettings }) {
  const quoteUrl = absolutePublicQuoteUrl(quote);
  return (
    <a
      className="no-print fixed bottom-3 left-3 right-3 z-20 rounded-full bg-ischia-leaf px-5 py-3 text-center text-sm font-black text-white shadow-soft sm:hidden"
      href={publicWhatsappLink(publicQuoteInfoWhatsappMessage(quote, quoteUrl))}
      onClick={() => trackQuoteEvent({ quoteCode: quote.code, token: quote.token }, "whatsapp_clicked", { placement: "mobile_sticky" })}
    >
      {contentSettings.mobileWhatsappLabel}
    </a>
  );
}
