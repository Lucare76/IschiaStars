"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { FEATURE_FLAG_DEFINITIONS, FeatureFlagKey, FeatureFlags } from "@/lib/feature-flags";
import { AnnouncementSettings, defaultAnnouncementSettings } from "@/lib/announcement-settings";
import { playConfirmaSound, playStationAnnouncement } from "@/lib/client/announcement-player";
import { formatDateTime } from "@/lib/utils";

type LabTestQuote = {
  id: string;
  code: string;
  clientName: string;
  createdAt: string;
  publicUrl: string;
};

export function LabPageClient({
  initialFlags,
  initialTestQuotes,
  initialAnnouncementSettings
}: {
  initialFlags: FeatureFlags;
  initialTestQuotes: LabTestQuote[];
  initialAnnouncementSettings: AnnouncementSettings;
}) {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl bg-[#4C1D95] px-6 py-3 text-sm font-black text-white shadow-soft">
        🔬 Pannello Supervisor — Visibile solo a te
      </div>

      <FeatureFlagsSection initialFlags={initialFlags} />
      <AnnouncementSection initialSettings={initialAnnouncementSettings} />
      <TestQuotesSection initialTestQuotes={initialTestQuotes} />
    </div>
  );
}

function FeatureFlagsSection({ initialFlags }: { initialFlags: FeatureFlags }) {
  const [flags, setFlags] = useState(initialFlags);
  const [pendingFlag, setPendingFlag] = useState<FeatureFlagKey | null>(null);
  const [savedFlag, setSavedFlag] = useState<FeatureFlagKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(flag: FeatureFlagKey, value: boolean) {
    setError(null);
    setPendingFlag(flag);
    setFlags((current) => ({ ...current, [flag]: value }));

    const response = await adminApiFetch("/api/supervisor/feature-flags", {
      method: "POST",
      body: JSON.stringify({ flag, value })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: FeatureFlags; error?: string }>(response);
    setPendingFlag(null);

    if (!response.ok || !result?.ok || !result.data) {
      setFlags((current) => ({ ...current, [flag]: !value }));
      setError(adminApiErrorMessage(response, result, "Salvataggio non riuscito. Riprova."));
      return;
    }

    setFlags((current) => ({ ...current, [flag]: value }));
    setSavedFlag(flag);
    setTimeout(() => setSavedFlag((current) => (current === flag ? null : current)), 2000);
  }

  return (
    <section className="rounded-2xl bg-white/90 p-6 shadow-soft">
      <h2 className="text-xl font-black text-ischia-navy">Funzionalità nascoste</h2>
      <p className="mt-1 text-sm text-ischia-ink/60">Attiva o disattiva funzionalità in sviluppo, visibili solo internamente.</p>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="mt-5 grid gap-3">
        {FEATURE_FLAG_DEFINITIONS.map((definition) => (
          <div key={definition.key} className="flex items-center justify-between gap-4 rounded-xl bg-ischia-mist p-4">
            <div>
              <p className="font-mono text-sm font-bold text-ischia-navy">{definition.label}</p>
              <p className="mt-1 text-xs text-ischia-ink/60">{definition.description}</p>
            </div>
            <div className="flex items-center gap-3">
              {savedFlag === definition.key ? <span className="text-xs font-bold text-emerald-600">✓ Salvato</span> : null}
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={flags[definition.key]}
                  disabled={pendingFlag === definition.key}
                  onChange={(event) => handleToggle(definition.key, event.currentTarget.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
                <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnnouncementSection({ initialSettings }: { initialSettings: AnnouncementSettings }) {
  const [settings, setSettings] = useState<AnnouncementSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  function update<K extends keyof AnnouncementSettings>(key: K, value: AnnouncementSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    const response = await adminApiFetch("/api/admin/announcement-settings", {
      method: "POST",
      body: JSON.stringify(settings)
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: AnnouncementSettings; error?: string }>(response);
    setSaving(false);

    if (!response.ok || !result?.ok) {
      setError(adminApiErrorMessage(response, result, "Salvataggio non riuscito. Riprova."));
      return;
    }

    if (result.data) setSettings(result.data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleTest() {
    setTesting(true);
    await playStationAnnouncement(settings);
    setTimeout(() => setTesting(false), 1200);
  }

  async function handleAudioUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    setAudioError(null);
    setUploadingAudio(true);

    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/supervisor/announcement-audio", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body,
    }).catch(() => null);

    const result = await response?.json().catch(() => null) as { ok?: boolean; data?: { url: string }; error?: string } | null;
    setUploadingAudio(false);

    if (!response?.ok || !result?.ok || !result.data?.url) {
      setAudioError(result?.error ?? "Upload non riuscito. Riprova.");
      return;
    }

    update("notificationConfermaAudioUrl", result.data.url);
  }

  async function handleRemoveAudio() {
    setAudioError(null);
    setUploadingAudio(true);
    await fetch("/api/supervisor/announcement-audio", {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    setUploadingAudio(false);
    update("notificationConfermaAudioUrl", "");
  }

  const labelClass = "block text-sm font-semibold text-ischia-navy";
  const rangeClass = "w-full accent-[#1B3A5C]";
  const toggleClass = "relative inline-flex cursor-pointer items-center";

  return (
    <section className="rounded-2xl bg-white/90 p-6 shadow-soft">
      <h2 className="text-xl font-black text-ischia-navy">Annuncio notifiche</h2>
      <p className="mt-1 text-sm text-ischia-ink/60">
        Gestisce il suono o l&apos;annuncio vocale quando arriva una nuova attività cliente.
      </p>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="mt-5 grid gap-5">
        {/* Attiva annuncio */}
        <div className="flex items-center justify-between gap-4 rounded-xl bg-ischia-mist p-4">
          <div>
            <p className="font-semibold text-ischia-navy">Attiva annuncio notifiche</p>
            <p className="mt-0.5 text-xs text-ischia-ink/60">Riproduce un annuncio vocale alla campanella quando arriva una nuova notifica.</p>
          </div>
          <label className={toggleClass}>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={settings.notificationVoiceAnnouncement}
              onChange={(e) => update("notificationVoiceAnnouncement", e.currentTarget.checked)}
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
          </label>
        </div>

        {/* Testo annuncio */}
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="ann-message">Testo annuncio</label>
          <textarea
            id="ann-message"
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-ischia-mist px-3 py-2 text-sm text-ischia-ink focus:outline-none focus:ring-2 focus:ring-ischia-blue/40"
            value={settings.notificationAnnouncementMessage}
            onChange={(e) => update("notificationAnnouncementMessage", e.currentTarget.value)}
          />
        </div>

        {/* Jingle */}
        <div className="flex items-center justify-between gap-4 rounded-xl bg-ischia-mist p-4">
          <div>
            <p className="font-semibold text-ischia-navy">Usa jingle stazione prima della voce</p>
            <p className="mt-0.5 text-xs text-ischia-ink/60">Riproduce due note stile stazione ferroviaria prima dell&apos;annuncio vocale.</p>
          </div>
          <label className={toggleClass}>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={settings.notificationAnnouncementJingle}
              onChange={(e) => update("notificationAnnouncementJingle", e.currentTarget.checked)}
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
          </label>
        </div>

        {/* Volume / Rate / Pitch */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="ann-volume">
              Volume — <span className="font-mono text-ischia-blue">{settings.notificationAnnouncementVolume.toFixed(2)}</span>
            </label>
            <input
              id="ann-volume"
              type="range"
              className={rangeClass}
              min={0.1} max={1} step={0.05}
              value={settings.notificationAnnouncementVolume}
              onChange={(e) => update("notificationAnnouncementVolume", parseFloat(e.currentTarget.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="ann-rate">
              Velocità voce — <span className="font-mono text-ischia-blue">{settings.notificationAnnouncementRate.toFixed(2)}</span>
            </label>
            <input
              id="ann-rate"
              type="range"
              className={rangeClass}
              min={0.6} max={1.3} step={0.05}
              value={settings.notificationAnnouncementRate}
              onChange={(e) => update("notificationAnnouncementRate", parseFloat(e.currentTarget.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="ann-pitch">
              Tono voce — <span className="font-mono text-ischia-blue">{settings.notificationAnnouncementPitch.toFixed(2)}</span>
            </label>
            <input
              id="ann-pitch"
              type="range"
              className={rangeClass}
              min={0.6} max={1.4} step={0.05}
              value={settings.notificationAnnouncementPitch}
              onChange={(e) => update("notificationAnnouncementPitch", parseFloat(e.currentTarget.value))}
            />
          </div>
        </div>

        {/* Canzone prenotazione confermata */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 grid gap-3">
          <div>
            <p className="font-semibold text-ischia-navy">Canzone — prenotazione confermata</p>
            <p className="mt-0.5 text-xs text-ischia-ink/60">
              Viene riprodotta al posto della fanfara sintetizzata quando arriva una conferma prenotazione.
              Formati supportati: MP3, WAV, OGG, M4A — max 10 MB.
            </p>
          </div>

          {settings.notificationConfermaAudioUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <audio
                controls
                src={settings.notificationConfermaAudioUrl}
                className="h-9 max-w-xs rounded"
              />
              <button
                type="button"
                onClick={() => playConfirmaSound(settings.notificationAnnouncementVolume, settings.notificationConfermaAudioUrl).catch(() => null)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ischia-navy ring-1 ring-ischia-blue/20"
              >
                Prova
              </button>
              <button
                type="button"
                onClick={handleRemoveAudio}
                disabled={uploadingAudio}
                className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-60"
              >
                Rimuovi
              </button>
            </div>
          ) : (
            <p className="text-xs text-ischia-ink/50 italic">Nessuna canzone caricata — verrà suonata la fanfara di default.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className={`cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold text-ischia-navy ring-1 ring-ischia-blue/20 ${uploadingAudio ? "opacity-60 pointer-events-none" : ""}`}>
              {uploadingAudio ? "Caricamento…" : settings.notificationConfermaAudioUrl ? "Sostituisci canzone" : "Carica canzone"}
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={handleAudioUpload}
                disabled={uploadingAudio}
              />
            </label>
            {audioError ? <p className="text-xs font-semibold text-red-600">{audioError}</p> : null}
          </div>
        </div>

        {/* Pulsanti */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-[#1B3A5C] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : "Salva impostazioni"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-full bg-ischia-mist px-5 py-2 text-sm font-semibold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
          >
            {testing ? "In riproduzione…" : "Prova annuncio"}
          </button>
          {saved ? <span className="text-sm font-bold text-emerald-600">✓ Salvato</span> : null}
        </div>

        <p className="text-xs text-ischia-ink/50">
          L&apos;annuncio funziona solo quando il gestionale è aperto e il browser consente la riproduzione audio.
        </p>
      </div>
    </section>
  );
}

function TestQuotesSection({ initialTestQuotes }: { initialTestQuotes: LabTestQuote[] }) {
  const router = useRouter();
  const [testQuotes, setTestQuotes] = useState(initialTestQuotes);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setError(null);
    const response = await adminApiFetch(`/api/supervisor/test-quotes/${id}`, { method: "DELETE" });
    const result = await readAdminApiJson<{ ok?: boolean; error?: string }>(response);
    setConfirmingDeleteId(null);

    if (!response.ok || !result?.ok) {
      setError(adminApiErrorMessage(response, result, "Eliminazione non riuscita. Riprova."));
      return;
    }

    setTestQuotes((current) => current.filter((quote) => quote.id !== id));
  }

  return (
    <section className="rounded-2xl bg-white/90 p-6 shadow-soft">
      <h2 className="text-xl font-black text-ischia-navy">Preventivi di test</h2>
      <p className="mt-1 text-sm text-ischia-ink/60">Crea preventivi fittizi per testare il flusso cliente. Non vengono mai mostrati a Diego né conteggiati nelle statistiche.</p>

      <button
        type="button"
        onClick={() => router.push("/admin/preventivi/nuovo?lab=true")}
        className="mt-5 rounded-full bg-[#1B3A5C] px-5 py-2 text-sm font-medium text-white"
      >
        + Crea preventivo di test
      </button>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wide text-ischia-ink/50">
              <th className="py-2 pr-4">Codice</th>
              <th className="py-2 pr-4">Cliente</th>
              <th className="py-2 pr-4">Creato il</th>
              <th className="py-2 pr-4">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {testQuotes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-ischia-ink/50">Nessun preventivo di test creato.</td>
              </tr>
            ) : (
              testQuotes.map((quote) => (
                <tr key={quote.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-bold text-ischia-navy">{quote.code}</td>
                  <td className="py-2 pr-4">{quote.clientName}</td>
                  <td className="py-2 pr-4 text-ischia-ink/60">{formatDateTime(quote.createdAt)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={quote.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-ischia-mist px-3 py-1.5 text-xs font-bold text-ischia-navy"
                      >
                        Apri come cliente
                      </a>
                      <Link
                        href={`/admin/preventivi/${quote.code}`}
                        className="rounded-full bg-ischia-leaf px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Gestisci / invia email
                      </Link>
                      {confirmingDeleteId === quote.id ? (
                        <span className="flex items-center gap-2 text-xs font-semibold">
                          Sei sicuro?
                          <button type="button" onClick={() => handleDelete(quote.id)} className="rounded-full bg-red-600 px-3 py-1 font-bold text-white">Sì, elimina</button>
                          <button type="button" onClick={() => setConfirmingDeleteId(null)} className="rounded-full bg-slate-200 px-3 py-1 font-bold text-ischia-ink">Annulla</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(quote.id)}
                          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Re-export default announcement settings for external use without importing the lib directly
export { defaultAnnouncementSettings };
