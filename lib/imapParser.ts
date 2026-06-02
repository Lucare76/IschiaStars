import 'server-only';

import { createHash } from 'crypto';
import { ImapFlow } from 'imapflow';
import { AddressObject, simpleParser } from 'mailparser';
import { createQuoteRequest } from '@/lib/repositories/quoteRequests';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ------ Config ------

export function getImapConfig() {
  const host = process.env.MAIL_INBOX_HOST?.trim();
  const user = process.env.MAIL_INBOX_USER?.trim();
  const password = process.env.MAIL_INBOX_PASSWORD?.trim();
  if (!host || !user || !password) return null;

  const portRaw = process.env.MAIL_INBOX_PORT?.trim();
  const secureRaw = process.env.MAIL_INBOX_SECURE?.trim();
  const folder = process.env.MAIL_INBOX_FOLDER?.trim() || 'INBOX';
  const lookbackRaw = parseInt(process.env.MAIL_INBOX_LOOKBACK_DAYS?.trim() ?? '7', 10);

  return {
    host,
    port: portRaw ? parseInt(portRaw, 10) : 993,
    secure: secureRaw !== 'false',
    user,
    password,
    folder,
    lookbackDays: Number.isFinite(lookbackRaw) && lookbackRaw > 0 ? lookbackRaw : 7,
  };
}

// ------ Result type ------

export type PollImapResult = {
  provider: 'imap';
  mailbox: string;
  imported: number;
  skipped: number;
  duplicates: number;
  ignored: number;
  needsReview: number;
  errors: string[];
  details: string[];
};

// ------ Text helpers ------

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractAddressTexts(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  return (Array.isArray(addr) ? addr : [addr]).map((a) => a.text).filter(Boolean);
}

// ------ Date parsing (same logic as gmailParser) ------

function normalizeFormDate(value: string, fallbackYear?: number | null): string {
  const trimmed = value.trim();
  const italian = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (italian) {
    const year = Number(italian[3]);
    const safeYear = year >= 2000 ? year : fallbackYear;
    return safeYear
      ? `${safeYear}-${italian[2].padStart(2, '0')}-${italian[1].padStart(2, '0')}`
      : trimmed;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const safeYear = year >= 2000 ? year : fallbackYear;
    return safeYear ? `${safeYear}-${iso[2]}-${iso[3]}` : trimmed;
  }
  return trimmed;
}

function yearFromDate(value: string): number | null {
  const match = value.match(/^(\d{4})-/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 2000 ? year : null;
}

// ------ Email body parsing (same field map as gmailParser) ------

function parseEmailText(text: string, metadata: Record<string, unknown>) {
  const get = (field: string) => {
    const match = text.match(new RegExp(`${field}:\\s*([^\\n\\r]+)`, 'i'));
    return match ? match[1].trim() : null;
  };

  const pageUrl = get('Page URL') ?? '';
  const utmSource = pageUrl.match(/utm_source=([^&]+)/)?.[1] ?? null;
  const utmCampaign = pageUrl.match(/utm_campaign=([^&]+)/)?.[1]?.replace(/\+/g, ' ') ?? null;
  const hotel = get('Hotel');
  const etaBambini = get('Età Bambini') ?? get('Eta Bambini') ?? get('EtÃ  Bambini');
  const bambini = parseInt(get('Bambini') ?? '0');
  const rawCheckIn = get('Data di arrivo') ?? '';
  const rawCheckOut = get('Data di partenza') ?? '';
  const checkOut = normalizeFormDate(rawCheckOut);
  const checkIn = normalizeFormDate(rawCheckIn, yearFromDate(checkOut));

  const children =
    etaBambini && bambini > 0
      ? etaBambini.split(',').map((eta: string) => ({ age: parseInt(eta.trim()), firstName: undefined }))
      : [];

  return {
    firstName: get('Nome') ?? '',
    lastName: get('Cognome') ?? '',
    email: get('Email') ?? '',
    phone: get('Telefono') ?? '',
    destination: 'Ischia',
    checkIn,
    checkOut,
    adults: parseInt(get('Adulti') ?? '2'),
    children,
    rooms: parseInt(get('Numero di Camere') ?? '1'),
    message: get('Messaggio') ?? undefined,
    receivedAt: typeof metadata.email_date === 'string' ? metadata.email_date : undefined,
    metadata: {
      requested_hotel: hotel,
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      source_url: pageUrl,
      orario_chiamata: get('Orario di preferenza chiamata'),
      fonte: 'email_automatica',
      ...metadata,
    },
  };
}

function looksLikeQuoteRequest(text: string, subject: string): boolean {
  const haystack = `${subject} ${text}`.toLowerCase();
  const signals = [
    'data di arrivo', 'data di partenza', 'check-in', 'check-out',
    'arrivo', 'partenza', 'preventivo', 'richiesta',
    'adulti', 'bambini', 'camere', 'numero di camere',
    'hotel', 'nome:', 'cognome:', 'telefono:', 'email:',
    'soggiorno', 'ischia',
  ];
  return signals.filter((s) => haystack.includes(s)).length >= 3;
}

function isDuplicateError(errMsg: string): boolean {
  return (
    errMsg.includes('quote_requests_gmail_message_id_uidx') ||
    errMsg.includes('quote_requests_imap_message_id_uidx') ||
    errMsg.includes('duplicate key value violates unique constraint') ||
    errMsg.includes('23505')
  );
}

// Fallback unique key when RFC Message-ID header is absent
function syntheticMessageId(from: string, subject: string, date: string): string {
  const hash = createHash('sha256')
    .update(`${from}|${subject}|${date}`)
    .digest('hex')
    .slice(0, 32);
  return `synthetic:${hash}`;
}

// ------ Supabase helpers — mirror gmailParser, same tables ------
// email_import_ledger.gmail_message_id is repurposed as a provider-agnostic
// unique message key. For IMAP messages we store the RFC Message-ID there.

type LedgerStatus =
  | 'imported'
  | 'duplicate'
  | 'ignored_non_quote'
  | 'needs_review'
  | 'parse_failed'
  | 'deleted_by_admin'
  | 'archived_by_admin';

async function reserveLedgerMessage(input: {
  messageId: string;
  rfcMessageId: string;
  subject: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  receivedAt: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ exists: boolean; status?: string; error?: string }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { exists: false };

  const existing = await supabase
    .from('email_import_ledger')
    .select('status')
    .eq('gmail_message_id', input.messageId)
    .maybeSingle();
  if (existing.error) return { exists: false, error: existing.error.message };
  if (existing.data) return { exists: true, status: String(existing.data.status ?? '') };

  const inserted = await supabase.from('email_import_ledger').insert({
    gmail_message_id: input.messageId,
    rfc_message_id: input.rfcMessageId || null,
    subject: input.subject || null,
    from_email: input.fromEmail || null,
    to_emails: input.toEmails,
    cc_emails: input.ccEmails,
    received_at: input.receivedAt,
    status: 'needs_review',
    metadata: {
      ...(input.metadata ?? {}),
      reserved_at: new Date().toISOString(),
    },
  });

  if (!inserted.error) return { exists: false };
  if (inserted.error.code === '23505') {
    const raced = await supabase
      .from('email_import_ledger')
      .select('status')
      .eq('gmail_message_id', input.messageId)
      .maybeSingle();
    return { exists: true, status: String(raced.data?.status ?? 'unknown') };
  }
  return { exists: false, error: inserted.error.message };
}

async function updateLedgerMessage(
  messageId: string,
  input: {
    status: LedgerStatus;
    quoteRequestId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('email_import_ledger')
    .update({
      status: input.status,
      ...(input.quoteRequestId ? { quote_request_id: input.quoteRequestId } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('gmail_message_id', messageId);
  if (error)
    console.warn(`[mail-inbox] ledger update failed msgId=${messageId.slice(0, 40)} reason=${error.message}`);
}

async function saveInboundNeedsReview(input: {
  messageId: string;
  rfcMessageId: string;
  subject: string;
  date: string | null;
  reason: string;
  body: string;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase
    .from('inbound_emails')
    .upsert(
      {
        gmail_message_id: input.messageId,
        rfc_message_id: input.rfcMessageId || null,
        subject: input.subject || null,
        received_at: input.date,
        status: 'needs_review',
        skipped_reason: input.reason,
        headers: [],
        body_text: input.body.slice(0, 10_000),
      },
      { onConflict: 'gmail_message_id' }
    );
  if (error)
    console.warn(`[mail-inbox] inbound needs_review save failed reason=${error.message}`);
}

async function isDuplicateImapMessage(
  messageId: string
): Promise<{ isDuplicate: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { isDuplicate: false };

  const { data, error } = await supabase
    .from('quote_requests')
    .select('id')
    .contains('metadata', { imap_message_id: messageId })
    .limit(1);
  if (error) return { isDuplicate: false, error: error.message };
  return { isDuplicate: Boolean(data?.length) };
}

// ------ Main export ------

export async function pollImapInbox(): Promise<PollImapResult> {
  const config = getImapConfig();
  const mailbox = config?.user ?? '';

  const result: PollImapResult = {
    provider: 'imap',
    mailbox,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    ignored: 0,
    needsReview: 0,
    errors: [],
    details: [],
  };

  if (!config) {
    result.errors.push('Casella email non configurata. Verifica MAIL_INBOX_*.');
    return result;
  }

  console.info(
    `[mail-inbox] provider=imap host=${config.host} user=${config.user} folder=${config.folder} lookback=${config.lookbackDays}d`
  );

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  try {
    await client.connect();
  } catch (connErr) {
    const errMsg = connErr instanceof Error ? connErr.message : String(connErr);
    console.error(`[mail-inbox] connection failed host=${config.host} err=${errMsg}`);
    result.errors.push(`Connessione IMAP fallita: ${errMsg}`);
    return result;
  }

  const lock = await client.getMailboxLock(config.folder);

  try {
    const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);
    const searchResult = await client.search({ since }, { uid: true });
    const uids: number[] = searchResult || [];
    console.info(
      `[mail-inbox] messages found count=${uids.length} since=${since.toISOString().slice(0, 10)}`
    );

    if (!uids.length) return result;

    // Cap to most recent 200 to stay within Vercel function timeout
    const limited = uids.slice(-200);

    for await (const msg of client.fetch(limited, { source: true }, { uid: true })) {
      try {
        if (!msg.source) {
          result.errors.push(`Uid ${msg.uid}: source vuoto`);
          continue;
        }

        const parsed = await simpleParser(msg.source);

        const rfcMessageId = (parsed.messageId ?? '').trim();
        const subject = parsed.subject ?? '';
        const date = parsed.date ? parsed.date.toISOString() : null;
        const fromText = parsed.from?.text ?? '';
        const toTexts = extractAddressTexts(parsed.to);
        const ccTexts = extractAddressTexts(parsed.cc);

        // RFC Message-ID is globally unique; fall back to synthetic hash
        const messageId =
          rfcMessageId || syntheticMessageId(fromText, subject, date ?? '');

        console.info(
          `[mail-inbox] candidate uid=${msg.uid} subject="${subject.slice(0, 60)}" msgId=${messageId.slice(0, 40)}`
        );

        // Step 1: ledger reservation (primary dedup gate)
        const ledger = await reserveLedgerMessage({
          messageId,
          rfcMessageId,
          subject,
          fromEmail: fromText,
          toEmails: toTexts,
          ccEmails: ccTexts,
          receivedAt: date,
          metadata: { source: 'imap_poll', uid: msg.uid },
        });

        if (ledger.exists) {
          const status = ledger.status ?? 'unknown';
          console.info(
            `[mail-inbox] skipped already_processed status=${status} uid=${msg.uid}`
          );
          result.duplicates++;
          result.skipped++;
          if (status === 'deleted_by_admin') result.details.push(`uid ${msg.uid}: skipped deleted_by_admin`);
          result.details.push(`uid ${msg.uid}: skipped already_processed status=${status}`);
          continue;
        }
        if (ledger.error) {
          console.warn(
            `[mail-inbox] ledger reserve failed uid=${msg.uid} reason=${ledger.error} — DB constraint is safety net`
          );
        }

        // Step 2: secondary dedup via quote_requests metadata
        const dupCheck = await isDuplicateImapMessage(messageId);
        if (dupCheck.isDuplicate) {
          console.info(`[mail-inbox] skipped duplicate uid=${msg.uid}`);
          await updateLedgerMessage(messageId, {
            status: 'duplicate',
            metadata: { reason: 'quote_requests_match' },
          });
          result.duplicates++;
          result.skipped++;
          result.details.push(`uid ${msg.uid}: skipped duplicate`);
          continue;
        }
        if (dupCheck.error) {
          console.warn(
            `[mail-inbox] duplicate check failed uid=${msg.uid} reason=${dupCheck.error} — will attempt insert`
          );
        }

        // Step 3: extract body text
        const emailText =
          parsed.text ||
          (parsed.html ? htmlToText(parsed.html) : '');
        const bodyLen = emailText.length;
        const snippet = emailText.slice(0, 120).replace(/\n/g, ' ');

        if (!emailText || !emailText.includes('Data di arrivo')) {
          if (looksLikeQuoteRequest(emailText, subject)) {
            const detail = `uid ${msg.uid}: needs_review reason=parse_failed_quote_candidate body_len=${bodyLen}`;
            console.info(
              `[mail-inbox] needs_review subject="${subject.slice(0, 60)}" body_len=${bodyLen} snippet="${snippet}"`
            );
            await saveInboundNeedsReview({
              messageId,
              rfcMessageId,
              subject,
              date,
              reason: 'parse_failed_quote_candidate',
              body: emailText,
            });
            await updateLedgerMessage(messageId, {
              status: 'needs_review',
              metadata: { reason: 'parse_failed_quote_candidate', body_len: bodyLen },
            });
            result.needsReview++;
            result.skipped++;
            result.details.push(detail);
          } else {
            const detail = `uid ${msg.uid}: ignored reason=non_quote_email body_len=${bodyLen}`;
            console.info(
              `[mail-inbox] ignored subject="${subject.slice(0, 60)}" body_len=${bodyLen}`
            );
            await updateLedgerMessage(messageId, {
              status: 'ignored_non_quote',
              metadata: { reason: 'non_quote_email', body_len: bodyLen },
            });
            result.ignored++;
            result.skipped++;
            result.details.push(detail);
          }
          continue;
        }

        // Step 4: parse quote fields
        const input = parseEmailText(emailText, {
          imap_message_id: messageId,
          imap_rfc_message_id: rfcMessageId,
          email_subject: subject,
          email_date: date,
          source_channel: 'imap',
          imap_uid: msg.uid,
        });

        const missingFields = [
          !input.firstName ? 'firstName' : null,
          !input.lastName ? 'lastName' : null,
          !input.email ? 'email' : null,
          !input.phone ? 'phone' : null,
          !input.checkIn ? 'checkIn' : null,
          !input.checkOut ? 'checkOut' : null,
        ]
          .filter(Boolean)
          .join(',');

        if (missingFields) {
          const detail = `uid ${msg.uid}: skipped parse_failed fields=${missingFields}`;
          console.info(
            `[mail-inbox] skipped parse_failed fields=${missingFields} body_len=${bodyLen} snippet="${snippet}"`
          );
          await saveInboundNeedsReview({
            messageId,
            rfcMessageId,
            subject,
            date,
            reason: `missing_fields:${missingFields}`,
            body: emailText,
          });
          await updateLedgerMessage(messageId, {
            status: 'needs_review',
            metadata: { reason: 'missing_fields', fields: missingFields.split(',') },
          });
          result.needsReview++;
          result.skipped++;
          result.details.push(detail);
          continue;
        }

        // Step 5: persist
        const createResult = await createQuoteRequest(input);

        if (createResult.data) {
          console.info(
            `[mail-inbox] inserted quote_request id=${createResult.data.id} client="${input.firstName} ${input.lastName}"`
          );
          await updateLedgerMessage(messageId, {
            status: 'imported',
            quoteRequestId: createResult.data.id,
            metadata: { client: `${input.firstName} ${input.lastName}`.trim() },
          });
          result.imported++;
        } else {
          const errMsg = String(createResult.error ?? 'createQuoteRequest returned no data');
          if (isDuplicateError(errMsg)) {
            const detail = `uid ${msg.uid}: skipped duplicate reason=db_unique_conflict`;
            console.info(`[mail-inbox] skipped duplicate reason=db_unique_conflict uid=${msg.uid}`);
            await updateLedgerMessage(messageId, {
              status: 'duplicate',
              metadata: { reason: 'db_unique_conflict' },
            });
            result.duplicates++;
            result.skipped++;
            result.details.push(detail);
          } else {
            console.error(`[mail-inbox] failed to insert quote_request uid=${msg.uid} err=${errMsg}`);
            await updateLedgerMessage(messageId, {
              status: 'parse_failed',
              metadata: { error: errMsg.slice(0, 500) },
            });
            result.errors.push(`Uid ${msg.uid}: ${errMsg}`);
          }
        }
      } catch (msgErr) {
        const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
        console.error(`[mail-inbox] error processing uid ${msg.uid}: ${errMsg}`);
        result.errors.push(`Uid ${msg.uid}: ${errMsg}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[mail-inbox] imap error: ${errMsg}`);
    result.errors.push(errMsg);
  } finally {
    lock.release();
    try {
      await client.logout();
    } catch {
      // best effort
    }
  }

  console.info(
    `[mail-inbox] completed imported=${result.imported} skipped=${result.skipped} duplicates=${result.duplicates} ignored=${result.ignored} needsReview=${result.needsReview} errors=${result.errors.length}`
  );

  return result;
}
