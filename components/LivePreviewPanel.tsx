"use client";

import { useState } from "react";
import { QuoteProposalSection } from "@/components/QuoteProposalSection";
import { Quote } from "@/lib/types";

function EyeIcon() {
  return (
    <svg fill="none" height={14} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={14}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type Props = { quote: Quote };

export function LivePreviewPanel({ quote }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle visibile solo su mobile */}
      <button
        className="lg:hidden flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-ischia-navy"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="flex items-center gap-2">
          <EyeIcon />
          Anteprima cliente
        </span>
        <span className="text-xs text-gray-400">{open ? "Nascondi" : "Mostra"}</span>
      </button>

      {/* Pannello: sempre visibile su lg+, condizionale su mobile */}
      <div
        className={`rounded-xl border border-[#E5E7EB] overflow-y-auto ${open ? "block" : "hidden"} lg:block`}
        style={{ position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)" }}
      >
        <div className="flex items-center gap-1.5 border-b border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
          <EyeIcon />
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">Anteprima cliente</span>
        </div>
        {/* Scala 0.75 + pointer-events none → read-only */}
        <div style={{ pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: "133.33%" }}>
            <QuoteProposalSection quote={quote} hotelPopularity={{}} />
          </div>
        </div>
      </div>
    </>
  );
}
