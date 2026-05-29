import { google } from 'googleapis';
import { createQuoteRequest } from '@/lib/repositories/quoteRequests';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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

function parseEmailText(text: string) {
  const get = (field: string) => {
    const match = text.match(new RegExp(`${field}:\\s*(.+)`));
    return match ? match[1].trim() : null;
  };

  const pageUrl = get('Page URL') ?? '';
  const utmSource = pageUrl.match(/utm_source=([^&]+)/)?.[1] ?? null;
  const utmCampaign = pageUrl.match(/utm_campaign=([^&]+)/)?.[1]?.replace(/\+/g, ' ') ?? null;
  const hotel = get('Hotel');
  const etaBambini = get('Età Bambini') ?? get('Eta Bambini') ?? get('EtÃ  Bambini');
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

export async function pollGmail() {
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 10
    });

    const messages = res.data.messages ?? [];

    for (const message of messages) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });

      const emailText = extractEmailText(msg.data.payload);

      if (!emailText) continue;

      if (!emailText.includes('Data di arrivo') || !emailText.includes('Hotel')) continue;

      const input = parseEmailText(emailText);
      const result = await createQuoteRequest(input);

      if (result.data) {
        console.log(`Preventivo creato: ${input.firstName} ${input.lastName} - ${input.metadata.requested_hotel}`);
      }

      await gmail.users.messages.modify({
        userId: 'me',
        id: message.id!,
        requestBody: { removeLabelIds: ['UNREAD'] }
      });
    }
  } catch (err) {
    console.error('Errore polling Gmail:', err);
  }
}
