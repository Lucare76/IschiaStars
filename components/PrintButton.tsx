"use client";

import { trackQuoteEvent } from "@/lib/client-tracking";

export function PrintButton({ className, quoteCode, token, english = false }: { className?: string; quoteCode?: string; token?: string; english?: boolean }) {
  return (
    <button
      className={className ?? "rounded-full bg-white px-5 py-3 font-black text-ischia-navy ring-1 ring-ischia-blue/20"}
      type="button"
      onClick={() => {
        if (quoteCode && token) trackQuoteEvent({ quoteCode, token }, "print_clicked", { source: "print_button" });
        window.print();
      }}
    >
      {english ? "Print / Save PDF" : "Stampa / Salva PDF"}
    </button>
  );
}
