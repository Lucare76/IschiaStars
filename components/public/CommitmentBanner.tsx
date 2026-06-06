type Props = { show: boolean };

function AlertTriangleIcon() {
  return (
    <svg
      fill="none"
      height={20}
      stroke="#D97706"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      style={{ flexShrink: 0, marginTop: 2 }}
      viewBox="0 0 24 24"
      width={20}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

export function CommitmentBanner({ show }: Props) {
  if (!show) return null;
  return (
    <div
      style={{
        background: "#FEF3C7",
        borderLeft: "4px solid #D97706",
        borderRadius: 0,
        padding: "16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginTop: 16,
      }}
    >
      <AlertTriangleIcon />
      <div>
        <p style={{ fontWeight: 600, fontSize: 14, color: "#92400E", margin: 0 }}>
          Offerta soggetta a obbligo di impegnativa
        </p>
        <p style={{ fontSize: 14, color: "#B45309", marginTop: 4, marginBottom: 0 }}>
          La conferma di questa proposta comporta un impegno formale alla prenotazione.
          Per maggiori dettagli contattaci prima di confermare.
        </p>
      </div>
    </div>
  );
}
