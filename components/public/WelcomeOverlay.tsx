"use client";

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
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [progressMode, setProgressMode] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dismissed = useRef(false);
  const storageKey = `welcome_shown_${quoteCode}`;

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
    if (sessionStorage.getItem(storageKey)) return;
    setReady(true);

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
  }, [storageKey, handleDismiss]);

  if (!ready || gone) return null;

  const name = capitalizeName(customerFirstName);
  const activeDot = phase >= 4 ? 3 : phase >= 2 ? 2 : 1;

  return (
    // Sfondo blu che copre tutta la pagina (position: absolute; inset: 0)
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: "#1B3A5C",
        zIndex: 50,
        opacity: fading ? 0 : 1,
        transition: "opacity 800ms ease",
        pointerEvents: fading ? "none" : "auto",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={handleDismiss}
    >
      {/*
        Inner container sticky: si ancora al top del viewport e occupa 100vh,
        così il contenuto è sempre centrato rispetto allo schermo, non alla pagina.
      */}
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
        {/* Cerchio logo IS */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#C9A84C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 700,
            color: "#1B3A5C",
            flexShrink: 0,
            letterSpacing: "0.04em",
          }}
        >
          IS
        </div>

        {/* Titolo */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 600ms ease",
            textAlign: "center",
            fontSize: 24,
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

        {/* Sottotitolo */}
        <p
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transition: "opacity 600ms ease",
            fontSize: 13,
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

        {/* Hint tocca */}
        <p
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transition: "opacity 600ms ease",
            fontSize: 11,
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

        {/* Barra progresso — ancorata al fondo del viewport (bottom del container sticky) */}
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
