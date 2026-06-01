import { google } from 'googleapis';
import { createQuoteRequest } from '@/lib/repositories/quoteRequests';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const GMAIL_ACCOUNT = process.env.GMAIL_EMAIL || 'ischiastarspreventivi@gmail.com';
const ACCEPTED_RECIPIENTS = buildAcceptedRecipients();

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export type PollGmailResult = {
  imported: number;
  skipped: number;
  duplicates: number;
  ignored: number;
  needsReview: number;
  errors: string[];
  details: string[];
};

function decodeBody(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function htmlToText(html: string) {
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

// Prefer text/plain; only fall back to text/html if no plain part exists.
// This avoids misparse when multipart/alternative lists html before plain.
function extractPlainText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  return '';
}

function extractHtmlText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return htmlToText(decodeBody(payload.body.data));
  }
  for (const part of payload.parts ?? []) {
    const text = extractHtmlText(part);
    if (text) return text;
  }
  return '';
}

function extractEmailText(payload: any): string {
  return extractPlainText(payload) || extractHtmlText(payload);
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function buildAcceptedRecipients(): string[] {
  const configured = (process.env.GMAIL_ACCEPTED_RECIPIENTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set([
    GMAIL_ACCOUNT,
    process.env.BREVO_FROM_EMAIL,
    "info@ischiastars.it",
    ...configured
  ].filter(Boolean).map((value) => value!.toLowerCase())));
}

function isAddressedToAccount(headers: Array<{ name: string; value: string }>): boolean {
  const to = getHeader(headers, 'To');
  const cc = getHeader(headers, 'Cc');
  const combined = `${to} ${cc}`.toLowerCase();
  return ACCEPTED_RECIPIENTS.some((recipient) => combined.includes(recipient));
}

function buildGmailQuery(): string {
  const recipientQuery = ACCEPTED_RECIPIENTS
    .flatMap((recipient) => [`to:${recipient}`, `cc:${recipient}`])
    .join(' OR ');
  return `newer_than:14d (${recipientQuery})`;
}

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

  const children = etaBambini && bambini > 0
    ? etaBambini.split(',').map((eta: string) => ({
        age: parseInt(eta.trim()),
        firstName: undefined
      }))
    : [];

  return {
    firstName: get('Nome') ?? '',
    lastName: get('Cognome') ?? '',
    email: get('Email') ?? '',
    phone: get('Telefono') ?? '',
    destination: 'Ischia',
    checkIn: get('Data di arrivo') ?? '',
    checkOut: get('Data di partenza') ?? '',
    adults: parseInt(get('Adulti') ?? '2'),
    children,
    rooms: parseInt(get('Numero di Camere') ?? '1'),
    message: get('Messaggio') ?? undefined,
    metadata: {
      requested_hotel: hotel,
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      source_url: pageUrl,
      orario_chiamata: get('Orario di preferenza chiamata'),
      fonte: 'email_automatica',
      ...metadata
    }
  };
}

// Returns true if the email body/subject has enough signals to suggest it's a
// quote request from the IschiaStars form (or similar). Only these emails go to
// needsReview when the full parser fails — everything else is ignored.
function looksLikeQuoteRequest(text: string, subject: string): boolean {
  const haystack = `${subject} ${text}`.toLowerCase();
  const signals = [
    'data di arrivo', 'data di partenza', 'check-in', 'check-out',
    'arrivo', 'partenza', 'preventivo', 'richiesta',
    'adulti', 'bambini', 'camere', 'numero di camere',
    'hotel', 'nome:', 'cognome:', 'telefono:', 'email:',
    'soggiorno', 'ischia',
  ];
  const hits = signals.filter((s) => haystack.includes(s)).length;
  return hits >= 3;
}

function isDuplicateError(errMsg: string): boolean {
  return (
    errMsg.includes('quote_requests_gmail_message_id_uidx') ||
    errMsg.includes('duplicate key value violates unique constraint') ||
    errMsg.includes('23505')
  );
}

export async function pollGmail(): Promise<PollGmailResult> {
  const result: PollGmailResult = { imported: 0, skipped: 0, duplicates: 0, ignored: 0, needsReview: 0, errors: [], details: [] };

  console.info('[email-import] gmail connected');

  try {
    const query = buildGmailQuery();
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });

    const messages = res.data.messages ?? [];
    console.info(`[email-import] messages found count=${messages.length} query="${query}"`);

    for (const message of messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers: Array<{ name: string; value: string }> = msg.data.payload?.headers as any ?? [];
        const subject = getHeader(headers, 'Subject');
        const date = getHeader(headers, 'Date');
        const rfcMessageId = getHeader(headers, 'Message-ID');
        console.info(`[email-import] candidate date=${date || "-"} subject="${subject}" msgId=${message.id}`);

        if (!isAddressedToAccount(headers)) {
          const detail = `msg ${message.id}: skipped not_addressed`;
          console.info(`[email-import] skipped not_addressed msgId=${message.id}`);
          result.skipped++;
          result.details.push(detail);
          continue;
        }

        // Check duplicate before body extraction to save work
        const dupCheck = await isDuplicateGmailMessage(message.id!, rfcMessageId);
        if (dupCheck.isDuplicate) {
          const detail = `msg ${message.id}: skipped duplicate reason=gmail_message_id`;
          console.info(`[email-import] skipped duplicate reason=gmail_message_id msgId=${message.id}`);
          result.duplicates++;
          result.skipped++;
          result.details.push(detail);
          await markRead(message.id!);
          continue;
        }
        // If duplicate check failed due to a DB error, log but continue (DB constraint is the safety net)
        if (dupCheck.error) {
          console.warn(`[email-import] duplicate check query failed msgId=${message.id} reason=${dupCheck.error} — will attempt insert, DB constraint will catch duplicates`);
        }

        console.info(`[email-import] accepted to/cc match msgId=${message.id}`);

        const emailText = extractEmailText(msg.data.payload);
        const bodyLen = emailText.length;
        const snippet = emailText.slice(0, 120).replace(/\n/g, ' ');

        if (!emailText || !emailText.includes('Data di arrivo') || !emailText.includes('Hotel')) {
          if (looksLikeQuoteRequest(emailText, subject)) {
            const detail = `msg ${message.id}: needs_review reason=parse_failed_quote_candidate body_len=${bodyLen}`;
            console.info(`[email-import] needs_review reason=parse_failed_quote_candidate subject="${subject}" body_len=${bodyLen} snippet="${snippet}" msgId=${message.id}`);
            await saveInboundNeedsReview({
              gmailMessageId: message.id!,
              rfcMessageId,
              subject,
              date,
              reason: 'parse_failed_quote_candidate',
              headers,
              body: emailText
            });
            result.needsReview++;
            result.skipped++;
            result.details.push(detail);
          } else {
            const detail = `msg ${message.id}: ignored reason=non_quote_email body_len=${bodyLen}`;
            console.info(`[email-import] ignored reason=non_quote_email subject="${subject}" body_len=${bodyLen} msgId=${message.id}`);
            result.ignored++;
            result.skipped++;
            result.details.push(detail);
          }
          continue;
        }

        const input = parseEmailText(emailText, {
          gmail_message_id: message.id,
          gmail_rfc_message_id: rfcMessageId,
          email_subject: subject,
          email_date: date
        });

        if (!input.firstName || !input.lastName || !input.email || !input.phone || !input.checkIn || !input.checkOut) {
          const missingFields = [
            !input.firstName ? "firstName" : null,
            !input.lastName ? "lastName" : null,
            !input.email ? "email" : null,
            !input.phone ? "phone" : null,
            !input.checkIn ? "checkIn" : null,
            !input.checkOut ? "checkOut" : null
          ].filter(Boolean).join(",");
          const detail = `msg ${message.id}: skipped parse_failed reason=missing_fields fields=${missingFields}`;
          console.info(`[email-import] skipped parse_failed reason=missing_fields fields=${missingFields} body_len=${bodyLen} snippet="${snippet}" msgId=${message.id}`);
          await saveInboundNeedsReview({
            gmailMessageId: message.id!,
            rfcMessageId,
            subject,
            date,
            reason: `missing_fields:${missingFields}`,
            headers,
            body: emailText
          });
          result.needsReview++;
          result.skipped++;
          result.details.push(detail);
          continue;
        }

        const createResult = await createQuoteRequest(input);

        if (createResult.data) {
          console.info(`[email-import] inserted quote_request id=${createResult.data.id} client="${input.firstName} ${input.lastName}"`);
          result.imported++;
          await markRead(message.id!);
        } else {
          const errMsg = String(createResult.error ?? 'createQuoteRequest returned no data');
          if (isDuplicateError(errMsg)) {
            // DB unique constraint caught a race-condition duplicate — not an error
            const detail = `msg ${message.id}: skipped duplicate reason=db_unique_conflict`;
            console.info(`[email-import] skipped duplicate reason=db_unique_conflict msgId=${message.id}`);
            result.duplicates++;
            result.skipped++;
            result.details.push(detail);
            await markRead(message.id!);
          } else {
            console.error(`[email-import] failed to insert quote_request: ${errMsg} msgId=${message.id}`);
            result.errors.push(`Msg ${message.id}: ${errMsg}`);
          }
        }
      } catch (msgErr) {
        const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
        console.error(`[email-import] error processing message ${message.id}: ${errMsg}`);
        result.errors.push(`Msg ${message.id}: ${errMsg}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[email-import] gmail error: ${errMsg}`);
    result.errors.push(errMsg);
  }

  return result;
}

async function saveInboundNeedsReview(input: {
  gmailMessageId: string;
  rfcMessageId: string;
  subject: string;
  date: string;
  reason: string;
  headers: Array<{ name: string; value: string }>;
  body: string;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("inbound_emails")
    .upsert({
      gmail_message_id: input.gmailMessageId,
      rfc_message_id: input.rfcMessageId || null,
      subject: input.subject || null,
      received_at: input.date ? new Date(input.date).toISOString() : null,
      status: "needs_review",
      skipped_reason: input.reason,
      headers: input.headers,
      body_text: input.body
    }, { onConflict: "gmail_message_id" });
  if (error) console.warn(`[email-import] inbound needs_review save failed reason=${error.message}`);
}

async function isDuplicateGmailMessage(gmailMessageId: string, rfcMessageId: string): Promise<{ isDuplicate: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { isDuplicate: false };

  const byGmailId = await supabase
    .from("quote_requests")
    .select("id")
    .contains("metadata", { gmail_message_id: gmailMessageId })
    .limit(1);
  if (byGmailId.error) {
    return { isDuplicate: false, error: byGmailId.error.message };
  }
  if (byGmailId.data?.length) return { isDuplicate: true };
  if (!rfcMessageId) return { isDuplicate: false };

  const byRfcId = await supabase
    .from("quote_requests")
    .select("id")
    .contains("metadata", { gmail_rfc_message_id: rfcMessageId })
    .limit(1);
  if (byRfcId.error) {
    return { isDuplicate: false, error: byRfcId.error.message };
  }
  return { isDuplicate: Boolean(byRfcId.data?.length) };
}

async function markRead(messageId: string) {
  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] }
    });
  } catch {
    // Non-fatal: best effort
  }
}
