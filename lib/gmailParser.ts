import { google } from 'googleapis';
import { createQuoteRequest } from '@/lib/repositories/quoteRequests';

const GMAIL_ACCOUNT = 'ischiastarspreventivi@gmail.com';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export type PollGmailResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

function decodeBody(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .trim();
}

function extractEmailText(payload: any): string {
  if (!payload) return '';

  if (payload.body?.data) {
    const body = decodeBody(payload.body.data);
    if (payload.mimeType === 'text/plain') return body;
    if (payload.mimeType === 'text/html') return htmlToText(body);
  }

  for (const part of payload.parts ?? []) {
    const text = extractEmailText(part);
    if (text) return text;
  }

  return '';
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function isAddressedToAccount(headers: Array<{ name: string; value: string }>): boolean {
  const to = getHeader(headers, 'To');
  const cc = getHeader(headers, 'Cc');
  const combined = `${to} ${cc}`.toLowerCase();
  return combined.includes(GMAIL_ACCOUNT.toLowerCase());
}

function parseEmailText(text: string) {
  const get = (field: string) => {
    const match = text.match(new RegExp(`${field}:\\s*(.+)`));
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
        birthDate: new Date(
          new Date().getFullYear() - parseInt(eta.trim()),
          0, 1
        ).toISOString().split('T')[0],
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
      fonte: 'email_automatica'
    }
  };
}

export async function pollGmail(): Promise<PollGmailResult> {
  const result: PollGmailResult = { imported: 0, skipped: 0, errors: [] };

  console.info('[email-import] gmail connected');

  try {
    // Include both TO and CC emails addressed to the account
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread (to:${GMAIL_ACCOUNT} OR cc:${GMAIL_ACCOUNT})`,
      maxResults: 20
    });

    const messages = res.data.messages ?? [];
    console.info(`[email-import] messages found count=${messages.length}`);

    for (const message of messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers: Array<{ name: string; value: string }> = msg.data.payload?.headers as any ?? [];
        const subject = getHeader(headers, 'Subject');

        // Verify the account is in To or Cc (belt-and-suspenders beyond the query)
        if (!isAddressedToAccount(headers)) {
          console.info(`[email-import] skipped not addressed to account msgId=${message.id}`);
          result.skipped++;
          await markRead(message.id!);
          continue;
        }

        const emailText = extractEmailText(msg.data.payload);

        // Must contain form markers to be a quote request
        if (!emailText || !emailText.includes('Data di arrivo') || !emailText.includes('Hotel')) {
          console.info(`[email-import] skipped not a form submission subject="${subject}" msgId=${message.id}`);
          result.skipped++;
          await markRead(message.id!);
          continue;
        }

        console.info(`[email-import] message accepted to/cc match subject="${subject}" msgId=${message.id}`);

        const input = parseEmailText(emailText);
        const createResult = await createQuoteRequest(input);

        if (createResult.data) {
          console.info(`[email-import] inserted quote_request id=${createResult.data.id} client="${input.firstName} ${input.lastName}"`);
          result.imported++;
        } else {
          const errMsg = createResult.error ?? 'createQuoteRequest returned no data';
          console.error(`[email-import] failed to insert quote_request: ${errMsg}`);
          result.errors.push(`Msg ${message.id}: ${errMsg}`);
        }

        await markRead(message.id!);
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
