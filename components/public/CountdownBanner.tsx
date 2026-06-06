"use client";

import { useEffect, useState } from "react";
import { publicWhatsappLink } from "@/lib/utils";

type CountdownBannerProps = {
  offerExpiresAt: string | null;
  isConfirmed: boolean;
};

const EXPIRED_MESSAGE = "Ciao, vorrei sapere se la proposta è ancora disponibile";

function getRemainingMs(offerExpiresAt: string) {
  return new Date(offerExpiresAt).getTime() - Date.now();
}

function parseRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        background: "#1B3A5C",
        borderRadius: 10,
        padding: "10px 14px",
        minWidth: 56,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "white",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          color: "#C9A84C",
          letterSpacing: "0.07em",
          marginTop: 4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Dot() {
  return (
    <span
      style={{
        color: "#C9A84C",
        fontSize: 20,
        fontWeight: 700,
        paddingBottom: 12,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      ·
    </span>
  );
}

export function CountdownBanner({ offerExpiresAt, isConfirmed }: CountdownBannerProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(() => {
    if (isConfirmed || !offerExpiresAt) return null;
    return getRemainingMs(offerExpiresAt);
  });

  useEffect(() => {
    if (isConfirmed || !offerExpiresAt) {
      setRemainingMs(null);
      return;
    }

    setRemainingMs(getRemainingMs(offerExpiresAt));
    const interval = window.setInterval(() => {
      setRemainingMs(getRemainingMs(offerExpiresAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [offerExpiresAt, isConfirmed]);

  if (isConfirmed || !offerExpiresAt || remainingMs == null) return null;

  if (remainingMs <= 0) {
    return (
      <div
        className="mt-4"
        style={{
          background: "#F3F4F6",
          border: "1px solid #E5E7EB",
          borderRadius: 16,
          padding: "20px 28px",
        }}
      >
        <p className="font-semibold text-gray-600">Questa offerta non è più attiva.</p>
        <p className="mt-1 text-sm text-gray-500">
          Vuoi sapere se la soluzione che ti interessa è ancora disponibile?
        </p>
        <a
          className="mt-3 inline-flex rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-white"
          href={publicWhatsappLink(EXPIRED_MESSAGE)}
          rel="noopener noreferrer"
          target="_blank"
        >
          Scrivici su WhatsApp
        </a>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = parseRemaining(remainingMs);

  return (
    <div
      className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      style={{
        background: "#FBF5E6",
        border: "1.5px solid #C9A84C",
        borderRadius: 16,
        padding: "20px 28px",
      }}
    >
      {/* Left */}
      <div style={{ maxWidth: 280 }}>
        <div
          className="flex items-center gap-1.5"
          style={{
            color: "#C9A84C",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          <svg
            fill="none"
            height={14}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width={14}
          >
            <circle cx={12} cy={12} r={10} />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Tariffa bloccata per altre
        </div>
        <p style={{ color: "#8B7355", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Le tariffe e la disponibilità possono variare. Ti consigliamo di confermare entro questa data.
        </p>
      </div>

      {/* Center — countdown blocks */}
      <div className="flex flex-shrink-0 items-end gap-1.5">
        {days >= 1 && (
          <>
            <TimeBlock label="giorni" value={days} />
            <Dot />
          </>
        )}
        <TimeBlock label="ore" value={hours} />
        <Dot />
        <TimeBlock label="min" value={minutes} />
        <Dot />
        <TimeBlock label="sec" value={seconds} />
      </div>

      {/* Right — hidden on mobile */}
      <p
        className="hidden sm:block"
        style={{ color: "#8B7355", fontSize: 12, textAlign: "right", maxWidth: 160, margin: 0, lineHeight: 1.5 }}
      >
        Disponibilità limitata — conferma subito la tua proposta preferita
      </p>
    </div>
  );
}
