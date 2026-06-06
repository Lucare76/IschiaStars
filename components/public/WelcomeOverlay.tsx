"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  customerFirstName: string;
  quoteCode: string;
};

function capitalizeName(name: string): string {
  if (!name?.trim()) return "";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function WelcomeOverlay({ customerFirstName, quoteCode }: Props) {
  const storageKey = `welcome_shown_${quoteCode}`;

  // Lazy init: sul server restituisce true (overlay nell'HTML iniziale → nessun flash).
  // Sul client controlla sessionStorage prima del primo render.
  const [visible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !sessionStorage.getItem(storageKey);
  });
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [progressMode, setProgressMode] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dismissed = useRef(false);

  const handleDismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    sessionStorage.setItem(storageKey, "1");
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFading(true);
    const t = setTimeout(() => setGone(true), 800);
    timers.current.push(t);
  }, [storageKey]);

  useEffect(() => {
    // Già mostrato: dismiss immediato senza animazione
    if (!visible) {
      setGone(true);
      return;
    }

    const add = (fn: () => void, delay: number) => {
      const t = setTimeout(fn, delay);
      timers.current.push(t);
    };

    add(() => setPhase(1), 0);
    add(() => setPhase(2), 900);
    add(() => setPhase(3), 1200);
    add(() => setPhase(4), 1800);
    add(() => setProgressMode(true), 2000);
    add(() => setProgressWidth(100), 2010);
    add(handleDismiss, 4200);

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, [visible, handleDismiss]);

  if (!visible || gone) return null;

  const name = capitalizeName(customerFirstName);
  const activeDot = phase >= 4 ? 3 : phase >= 2 ? 2 : 1;

  return (
    // Sfondo blu che copre tutta la pagina.
    // opacity 1 subito — nessun fade-in. Solo il dismiss usa la transizione.
    <div
      onClick={handleDismiss}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: "#1B3A5C",
        zIndex: 50,
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 800ms ease" : "none",
        pointerEvents: fading ? "none" : "auto",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* Sticky al viewport: il contenuto rimane centrato nello schermo
          indipendentemente dall'altezza della pagina. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 32,
        }}
      >
        {/* Logo reale */}
        <Image
          src="/ischiastars-logo.png"
          alt="IschiaStars"
          width={140}
          height={140}
          priority
          style={{ objectFit: "contain", flexShrink: 0 }}
        />

        {/* Titolo */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 600ms ease",
            textAlign: "center",
            fontSize: 27,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.4,
          }}
        >
          {name ? `Ciao ${name},` : "Benvenuto,"}
          <br />
          ho preparato qualcosa per te
        </div>

        {/* Linea oro */}
        <div
          style={{
            height: 2,
            background: "#C9A84C",
            width: phase >= 2 ? 80 : 0,
            opacity: phase >= 2 ? 1 : 0,
            transition: "width 500ms ease, opacity 300ms ease",
            borderRadius: 1,
            flexShrink: 0,
          }}
        />

        {/* Frase emozionale */}
        <p
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transition: "opacity 600ms ease",
            fontSize: 23,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
            margin: 0,
          }}
        >
          Certi luoghi non si scelgono — ti scelgono.
        </p>

        {/* Sottotitolo */}
        <p
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transition: "opacity 600ms ease",
            fontSize: 21,
            color: "#C9A84C",
            textAlign: "center",
            lineHeight: 1.6,
            maxWidth: 260,
            margin: 0,
          }}
        >
          Ho selezionato le migliori soluzioni
          <br />
          per il tuo soggiorno a Ischia
        </p>

        {/* Hint */}
        <p
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transition: "opacity 600ms ease",
            fontSize: 17,
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            margin: 0,
          }}
        >
          Tocca per scoprire la tua proposta
        </p>

        {/* Dot indicatori */}
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3].map((dot) => (
            <div
              key={dot}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: activeDot === dot ? "#C9A84C" : "rgba(255,255,255,0.3)",
                transition: "background 300ms ease",
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Barra progresso — ancorata al fondo del container sticky = fondo viewport */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 3,
            background: "#C9A84C",
            width: `${progressWidth}%`,
            transition: progressMode ? "width 2s linear" : "none",
          }}
        />
      </div>
    </div>
  );
}
