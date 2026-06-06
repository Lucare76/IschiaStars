"use client";

import { useEffect, useRef, useState } from "react";
import { trackQuoteEvent } from "@/lib/client-tracking";
import { publicWhatsappLink } from "@/lib/utils";

function MessageCircleIcon() {
  return (
    <svg
      fill="none"
      height={28}
      stroke="#2563EB"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={28}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

type Props = {
  show: boolean;
  quoteCode: string;
  token: string;
};

export function HesitantClientBanner({ show, quoteCode, token }: Props) {
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!show) return;
    // Aspetta il primo paint prima di avviare la transizione
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setVisible(true);
      });
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [show]);

  if (!show) return null;

  const waLink = publicWhatsappLink(
    "Ciao, ho visto la vostra proposta e avrei qualche domanda prima di confermare."
  );

  function handleWhatsAppClick() {
    trackQuoteEvent({ quoteCode, token }, "hesitant_whatsapp_clicked");
  }

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 500ms ease 300ms, transform 500ms ease 300ms",
      }}
    >
      <div
        className="mt-6"
        style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: "var(--border-radius-lg, 12px)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span className="hidden sm:block" style={{ flexShrink: 0 }}>
          <MessageCircleIcon />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#1B3A5C", margin: 0 }}>
            Hai ancora dei dubbi?
          </p>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 0 }}>
            Scrivici, troviamo insieme la soluzione giusta per te.
          </p>
        </div>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          style={{
            background: "#25D366",
            color: "#fff",
            borderRadius: 9999,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            width: "100%",
            textAlign: "center",
            display: "block",
          }}
          className="sm:!w-auto sm:!inline"
        >
          Scrivici su WhatsApp
        </a>
      </div>
    </div>
  );
}
