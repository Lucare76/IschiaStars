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

function parseEmailText(text: string) {
  const get = (field: string) => {
    const match = text.match(new RegExp(`${field}:\\s*(.+)`));
    return match ? match[1].trim() : null;
  };

  const pageUrl = get('Page URL') ?? '';
  const utmSource = pageUrl.match(/utm_source=([^&]+)/)?.[1] ?? null;
  const utmCampaign = pageUrl.match(/utm_campaign=([^&]+)/)?.[1]?.replace(/\+/g, ' ') ?? null;
  const hotel = get('Hotel');
  const etaBambini = get('Età Bambini');
  const bambini = parseInt(get('Bambini') ?? '0');

  // Costruisci array bambini dalle età
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

      const parts = msg.data.payload?.parts ?? [];
      let emailText = '';

      // Prova prima text/plain
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          emailText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }

      // Se non trova parti, prova il body diretto
      if (!emailText && msg.data.payload?.body?.data) {
        emailText = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
      }

      if (!emailText) continue;

      // Verifica che sia una mail di IschiaStars
      if (!emailText.includes('Data di arrivo') || !emailText.includes('Hotel')) continue;

      const input = parseEmailText(emailText);
      const result = await createQuoteRequest(input);

      if (result.data) {
        console.log(`✅ Preventivo creato: ${input.firstName} ${input.lastName} - ${input.metadata.requested_hotel}`);
      }

      // Marca come letta
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
