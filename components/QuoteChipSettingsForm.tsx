"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { QuoteChipSettings } from "@/lib/quote-chip-settings";

type ChipGroup = "publicNoteChips" | "hotelNoteChips";

export function QuoteChipSettingsForm({ initialSettings }: { initialSettings: QuoteChipSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(initialSettings);
  const [drafts, setDrafts] = useState<Record<ChipGroup, string>>({ publicNoteChips: "", hotelNoteChips: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addChip(group: ChipGroup) {
    const value = drafts[group].trim();
    if (!value) return;
    const exists = form[group].some((chip) => chip.toLowerCase() === value.toLowerCase());
    if (exists) {
      setDrafts((current) => ({ ...current, [group]: "" }));
      return;
    }
    setForm((current) => ({ ...current, [group]: [...current[group], value] }));
    setDrafts((current) => ({ ...current, [group]: "" }));
  }

  function removeChip(group: ChipGroup, index: number) {
    setForm((current) => ({ ...current, [group]: current[group].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function moveChip(group: ChipGroup, index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form[group].length) return;
    setForm((current) => {
      const items = [...current[group]];
      const item = items[index];
      items[index] = items[nextIndex];
      items[nextIndex] = item;
      return { ...current, [group]: items };
    });
  }

  async function save() {
    setLoading(true);
    setMessage(null);
    const response = await adminApiFetch("/api/settings/quote-chips", {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify(form)
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: QuoteChipSettings; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Chip non salvati."));
      return;
    }
    setForm(result.data);
    setMessage("Chip preventivi salvati.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">Chip preventivi</h2>
          <p className="mt-1 text-sm text-ischia-ink/68">Frasi rapide usate durante la creazione e modifica dei preventivi.</p>
        </div>
        <button className="rounded-full bg-ischia-navy px-5 py-2 text-sm font-black text-white disabled:opacity-60" disabled={loading} onClick={() => void save()} type="button">
          {loading ? "Salvataggio..." : "Salva chip"}
        </button>
      </div>

      {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-semibold text-ischia-navy">{message}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChipList
          title="Note visibili al cliente"
          description="Chip mostrati nel campo note generali del preventivo."
          chips={form.publicNoteChips}
          draft={drafts.publicNoteChips}
          onDraftChange={(value) => setDrafts((current) => ({ ...current, publicNoteChips: value }))}
          onAdd={() => addChip("publicNoteChips")}
          onRemove={(index) => removeChip("publicNoteChips", index)}
          onMove={(index, direction) => moveChip("publicNoteChips", index, direction)}
        />
        <ChipList
          title="Note per struttura/camera"
          description="Chip mostrati nelle note cliente delle proposte hotel."
          chips={form.hotelNoteChips}
          draft={drafts.hotelNoteChips}
          onDraftChange={(value) => setDrafts((current) => ({ ...current, hotelNoteChips: value }))}
          onAdd={() => addChip("hotelNoteChips")}
          onRemove={(index) => removeChip("hotelNoteChips", index)}
          onMove={(index, direction) => moveChip("hotelNoteChips", index, direction)}
        />
      </div>
    </section>
  );
}

function ChipList({
  title,
  description,
  chips,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  onMove
}: {
  title: string;
  description: string;
  chips: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="rounded-2xl bg-ischia-mist/70 p-4 ring-1 ring-ischia-blue/10">
      <h3 className="font-black text-ischia-navy">{title}</h3>
      <p className="mt-1 text-sm text-ischia-ink/65">{description}</p>

      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-ischia-blue/20 px-3 py-2 text-sm"
          placeholder="Nuovo chip"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={onAdd} type="button">
          Aggiungi
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {chips.length ? chips.map((chip, index) => (
          <div key={`${chip}-${index}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-ischia-blue/10">
            <span className="min-w-0 flex-1 break-words font-semibold text-ischia-ink">{chip}</span>
            <button className="rounded-lg px-2 py-1 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/15 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index, -1)} type="button">↑</button>
            <button className="rounded-lg px-2 py-1 text-xs font-black text-ischia-navy ring-1 ring-ischia-blue/15 disabled:opacity-30" disabled={index === chips.length - 1} onClick={() => onMove(index, 1)} type="button">↓</button>
            <button className="rounded-lg px-2 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-200" onClick={() => onRemove(index)} type="button">Elimina</button>
          </div>
        )) : (
          <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ischia-ink/60">Nessun chip configurato.</p>
        )}
      </div>
    </div>
  );
}
