import "server-only";

import { getImapConfig, pollImapInbox, type PollImapResult } from "@/lib/imapParser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
const PERSISTENT_LOCK_KEY = "email_poll_lock";
const PERSISTENT_LOCK_TTL_MS = 2 * 60_000;

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
  }

  const lock = await acquirePersistentPollLock(options.source, startedAt);
  if (!lock.acquired) {
    console.info(`[poll-email] persistent_lock_active source=${options.source} remaining=${lock.remainingSeconds ?? 0}s`);
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
      message: lock.message,
      durationMs: Date.now() - startedAt,
      cooldownRemainingSeconds: lock.remainingSeconds
    };
  }

  if (options.source === "manual" && !options.bypassCooldown) {
    lastManualStartedAt = startedAt;
  }
  if (options.source === "cron") {
    lastCronStartedAt = startedAt;
  }

  pollInFlight = runPoll(options.source, startedAt).finally(async () => {
    try {
      await releasePersistentPollLock(lock.owner);
    } finally {
      pollInFlight = null;
    }
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

type PollLockResult = {
  acquired: boolean;
  owner: string;
  message: string;
  remainingSeconds?: number;
};

async function acquirePersistentPollLock(source: PollEmailNowSource, startedAt: number): Promise<PollLockResult> {
  const owner = `${source}-${startedAt}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { acquired: true, owner, message: "Lock locale acquisito" };
  }

  const nowIso = new Date(startedAt).toISOString();
  const lockedUntil = new Date(startedAt + PERSISTENT_LOCK_TTL_MS).toISOString();
  const lockValue = {
    owner,
    source,
    locked_at: nowIso,
    locked_until: lockedUntil
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from("settings")
    .update({
      value: lockValue,
      updated_at: nowIso
    })
    .eq("key", PERSISTENT_LOCK_KEY)
    .lt("value->>locked_until", nowIso)
    .select("value");

  if (updateError) {
    console.warn(`[poll-email] persistent_lock_update_failed source=${source} error=${updateError.message}`);
    return { acquired: true, owner, message: "Lock persistente non disponibile" };
  }

  if (updatedRows?.length) {
    return { acquired: true, owner, message: "Lock persistente acquisito" };
  }

  const { error: insertError } = await supabase.from("settings").insert({
    key: PERSISTENT_LOCK_KEY,
    value: lockValue,
    updated_at: nowIso
  });

  if (!insertError) {
    return { acquired: true, owner, message: "Lock persistente acquisito" };
  }

  if (insertError.code !== "23505") {
    console.warn(`[poll-email] persistent_lock_insert_failed source=${source} error=${insertError.message}`);
    return { acquired: true, owner, message: "Lock persistente non disponibile" };
  }

  const { data: currentRow, error: readError } = await supabase
    .from("settings")
    .select("value")
    .eq("key", PERSISTENT_LOCK_KEY)
    .maybeSingle();

  if (readError) {
    console.warn(`[poll-email] persistent_lock_read_failed source=${source} error=${readError.message}`);
    return { acquired: true, owner, message: "Lock persistente non disponibile" };
  }

  const currentLock = parsePollLock(currentRow?.value);
  if (!currentLock?.lockedUntil || Date.parse(currentLock.lockedUntil) <= startedAt) {
    return { acquired: true, owner, message: "Lock persistente non confermato" };
  }

  const remainingSeconds = Math.ceil((Date.parse(currentLock.lockedUntil) - startedAt) / 1000);
  return {
    acquired: false,
    owner,
    message: `Controllo email già in corso, attendi ${remainingSeconds} secondi`,
    remainingSeconds
  };
}

async function releasePersistentPollLock(owner: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const releasedAt = new Date().toISOString();
  const { error } = await supabase
    .from("settings")
    .update({
      value: {
        owner,
        released_at: releasedAt,
        locked_until: releasedAt
      },
      updated_at: releasedAt
    })
    .eq("key", PERSISTENT_LOCK_KEY)
    .eq("value->>owner", owner);

  if (error) console.warn(`[poll-email] persistent_lock_release_failed error=${error.message}`);
}

function parsePollLock(value: unknown): { owner?: string; lockedUntil?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    owner: typeof record.owner === "string" ? record.owner : undefined,
    lockedUntil: typeof record.locked_until === "string" ? record.locked_until : undefined
  };
}
