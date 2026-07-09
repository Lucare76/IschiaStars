import "server-only";

import { getImapConfig, pollImapInbox, type PollImapResult } from "@/lib/imapParser";

export type PollEmailNowSource = "cron" | "manual";

export type PollEmailNowResult = {
  ok: boolean;
  provider?: PollImapResult["provider"];
  mailbox?: string;
  processed: number;
  imported: number;
  skipped: number;
  duplicates: number;
  ignored: number;
  needsReview: number;
  errors: string[];
  details: string[];
  message: string;
  durationMs: number;
  cooldownRemainingSeconds?: number;
};

const MANUAL_COOLDOWN_MS = 60_000;
const CRON_COOLDOWN_MS = 10 * 60_000;

let pollInFlight: Promise<PollEmailNowResult> | null = null;
let lastManualStartedAt = 0;
let lastCronStartedAt = 0;

export function isEmailPollingConfigured() {
  return Boolean(getImapConfig());
}

export async function pollEmailNow(options: { source: PollEmailNowSource; bypassCooldown?: boolean }): Promise<PollEmailNowResult> {
  const startedAt = Date.now();

  if (!isEmailPollingConfigured()) {
    return {
      ok: false,
      processed: 0,
      imported: 0,
      skipped: 0,
      duplicates: 0,
      ignored: 0,
      needsReview: 0,
      errors: ["Casella email non configurata. Verifica MAIL_INBOX_*."],
      details: [],
      message: "Casella email non configurata",
      durationMs: 0
    };
  }

  if (pollInFlight) {
    console.info(`[poll-email] already_running source=${options.source}`);
    const result = await pollInFlight;
    return { ...result, message: "Controllo già in corso" };
  }

  if (options.source === "manual" && !options.bypassCooldown) {
    const elapsed = startedAt - lastManualStartedAt;
    if (elapsed < MANUAL_COOLDOWN_MS) {
      const remaining = Math.ceil((MANUAL_COOLDOWN_MS - elapsed) / 1000);
      console.info(`[poll-email] cooldown source=manual remaining=${remaining}s`);
      return {
        ok: false,
        processed: 0,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        ignored: 0,
        needsReview: 0,
        errors: [],
        details: [],
        message: `Attendi ${remaining} secondi prima di un nuovo controllo`,
        durationMs: Date.now() - startedAt,
        cooldownRemainingSeconds: remaining
      };
    }
    lastManualStartedAt = startedAt;
  }

  if (options.source === "cron") {
    const elapsed = startedAt - lastCronStartedAt;
    if (elapsed < CRON_COOLDOWN_MS) {
      const remaining = Math.ceil((CRON_COOLDOWN_MS - elapsed) / 1000);
      console.info(`[poll-email] cooldown source=cron remaining=${remaining}s`);
      return {
        ok: false,
        processed: 0,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        ignored: 0,
        needsReview: 0,
        errors: [],
        details: [],
        message: `Controllo email recente, attendi ${remaining} secondi`,
        durationMs: Date.now() - startedAt,
        cooldownRemainingSeconds: remaining
      };
    }
    lastCronStartedAt = startedAt;
  }

  pollInFlight = runPoll(options.source, startedAt).finally(() => {
    pollInFlight = null;
  });

  return pollInFlight;
}

async function runPoll(source: PollEmailNowSource, startedAt: number): Promise<PollEmailNowResult> {
  console.info(`[poll-email] start source=${source}`);
  const result = await pollImapInbox();
  const durationMs = Date.now() - startedAt;
  const processed = result.imported + result.skipped + result.errors.length;
  const ok = result.errors.length === 0;
  const message = !ok
    ? "Errore durante il controllo email"
    : result.imported > 0
      ? "Controllo completato"
      : "Nessuna nuova email trovata";

  console.info(
    `[poll-email] completed source=${source} processed=${processed} imported=${result.imported} skipped=${result.skipped} duplicates=${result.duplicates} ignored=${result.ignored} needsReview=${result.needsReview} errors=${result.errors.length} durationMs=${durationMs}`
  );

  return {
    ok,
    provider: result.provider,
    mailbox: result.mailbox,
    processed,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
    ignored: result.ignored,
    needsReview: result.needsReview,
    errors: result.errors,
    details: result.details,
    message,
    durationMs
  };
}
