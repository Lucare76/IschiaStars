"use client";

export function VoucherNotePresets({ presets, value, onChange }: {
  presets: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-ischia-ink/65">{presets.length ? "Clicca una frase per aggiungerla alle note. Puoi modificarla prima di salvare." : "Crea le tue note preimpostate nelle impostazioni per ritrovarle qui."}</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((phrase) => {
          const added = value.split("\n").some((line) => line.trim() === phrase);
          const next = [value.trimEnd(), phrase].filter(Boolean).join("\n");
          return (
            <button key={phrase} type="button" disabled={added || next.length > 500}
              className="rounded-full bg-white px-3 py-1.5 text-left text-xs font-semibold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-50"
              onClick={() => onChange(next)}>{added ? "✓ " : "+ "}{phrase}</button>
          );
        })}
      </div>
      <a href="/admin/impostazioni" className="inline-block text-xs font-semibold text-ischia-blue underline">Gestisci note preimpostate nelle impostazioni</a>
    </div>
  );
}
