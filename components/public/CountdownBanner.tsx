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

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  if (days >= 1) return `${days}g · ${paddedHours}h · ${paddedMinutes}m`;
  return `${paddedHours}h · ${paddedMinutes}m`;
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
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [offerExpiresAt, isConfirmed]);

  if (isConfirmed || !offerExpiresAt || remainingMs == null) return null;

  if (remainingMs <= 0) {
    return (
      <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-5 py-4">
        <p className="font-semibold text-gray-600">Questa offerta non è più attiva.</p>
        <p className="mt-1 text-sm text-gray-500">Vuoi sapere se la soluzione che ti interessa è ancora disponibile?</p>
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

  return (
    <div className="mt-4 rounded-xl border border-[#C9A84C] bg-[#FBF5E6] px-5 py-4">
      <p className="text-sm text-gray-500">Tariffa bloccata per altre</p>
      <p className="text-center text-2xl font-bold text-[#1B3A5C]">{formatRemaining(remainingMs)}</p>
      <p className="mt-1 text-xs text-gray-400">
        Le tariffe e la disponibilità possono variare. Ti consigliamo di confermare entro questa data.
      </p>
    </div>
  );
}
