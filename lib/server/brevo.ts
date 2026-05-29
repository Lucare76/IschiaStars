import type { Quote } from "@/lib/types";

type BrevoRecipient = { email: string; name?: string };

type SendBrevoEmailParams = {
  to: BrevoRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: BrevoRecipient;
};

export type BrevoConfirmationDetails = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  confirmedAt: string;
};

export function isBrevoEnabled(): boolean {
  return process.env.BREVO_ENABLED === "true";
}

export async function sendBrevoEmail(params: SendBrevoEmailParams): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "IschiaStars";

  if (!apiKey || !fromEmail) {
    console.error("[brevo] missing API key or sender email — check BREVO_API_KEY and BREVO_FROM_EMAIL");
    return false;
  }

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: params.to,
    subject: params.subject,
    htmlContent: params.html,
    ...(params.text ? { textContent: params.text } : {}),
    ...(params.replyTo ? { replyTo: params.replyTo } : {})
  };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) return true;

    const body = await response.text().catch(() => "(unreadable)");
    console.error(`[brevo] API error status=${response.status} message=${body.slice(0, 300)}`);
    return false;
  } catch (err) {
    console.error("[brevo] fetch error:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

export async function sendQuoteEmailToClient(quote: Quote): Promise<void> {
  if (!isBrevoEnabled()) {
    console.info("[brevo] skipped: disabled");
    return;
  }

  const email = quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn(`[brevo] skipped quote email ${quote.code}: invalid or missing client email`);
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const quoteUrl = `${siteUrl}/preventivi/${quote.code}?token=${quote.token}`;
  const firstName = quote.customerFirstName || "Cliente";
  const clientName = `${quote.customerFirstName} ${quote.customerLastName}`.trim();
  const hotelName = quote.proposedHotel?.name || "hotel selezionato";
  const replyEmail = process.env.BREVO_FROM_EMAIL || "info@ischiastars.it";
  const replyName = process.env.BREVO_FROM_NAME || "IschiaStars";

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#1a3a5c;padding:28px 32px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;">IschiaStars</p>
            <p style="margin:6px 0 0;color:#a8c4e0;font-size:13px;">Soggiorni a Ischia</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 18px;font-size:16px;color:#1a1a1a;">Ciao ${firstName},</p>
            <p style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.7;">
              Abbiamo preparato la tua proposta personalizzata per il soggiorno a Ischia.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f6ff;border-radius:6px;padding:20px 20px 12px;margin-bottom:28px;">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Codice preventivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;font-weight:600;">${quote.code}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Hotel proposto</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${hotelName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Arrivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.arrivalDate)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Partenza</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.departureDate)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Trattamento</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${quote.treatment || "—"}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 6px;font-size:16px;border-top:1px solid #cdd8e8;"><strong style="color:#1a3a5c;">Prezzo totale</strong></td>
                <td style="padding:12px 0 6px;font-size:16px;font-weight:bold;color:#1a3a5c;text-align:right;border-top:1px solid #cdd8e8;">${formatPrice(quote.totalPrice)}</td>
              </tr>
              ${quote.offerExpiresAt ? `<tr>
                <td style="padding:6px 0;font-size:13px;color:#555;"><strong style="color:#c05000;">Offerta valida fino al</strong></td>
                <td style="padding:6px 0;font-size:13px;color:#c05000;text-align:right;font-weight:600;">${formatDate(quote.offerExpiresAt)}</td>
              </tr>` : ""}
            </table>

            <div style="text-align:center;margin:28px 0 20px;">
              <a href="${quoteUrl}"
                 style="background:#1a3a5c;color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;letter-spacing:0.5px;">
                Apri il preventivo
              </a>
            </div>

            <p style="text-align:center;margin:0 0 6px;font-size:12px;color:#999;">
              Se il pulsante non funziona, copia e incolla questo link nel browser:
            </p>
            <p style="text-align:center;margin:0 0 28px;font-size:12px;word-break:break-all;">
              <a href="${quoteUrl}" style="color:#1a3a5c;">${quoteUrl}</a>
            </p>

            <p style="margin:0 0 12px;font-size:14px;color:#444444;line-height:1.7;">
              Dal preventivo potrai visualizzare i dettagli, le condizioni e confermare online.
            </p>
            <p style="margin:0;font-size:14px;color:#444444;line-height:1.7;">
              Per domande puoi rispondere a questa email oppure scriverci su WhatsApp.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f0f6ff;padding:20px 32px;text-align:center;border-top:1px solid #e0e8f0;">
            <p style="margin:0;font-size:13px;color:#666;">Il team IschiaStars</p>
            <p style="margin:4px 0 0;font-size:12px;color:#999;">info@ischiastars.it</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "IschiaStars — La tua proposta di soggiorno a Ischia",
    "",
    `Ciao ${firstName},`,
    "",
    "Abbiamo preparato la tua proposta personalizzata per il soggiorno a Ischia.",
    "",
    `Codice preventivo: ${quote.code}`,
    `Hotel proposto:    ${hotelName}`,
    `Arrivo:            ${formatDate(quote.arrivalDate)}`,
    `Partenza:          ${formatDate(quote.departureDate)}`,
    `Trattamento:       ${quote.treatment || "—"}`,
    `Prezzo totale:     ${formatPrice(quote.totalPrice)}`,
    ...(quote.offerExpiresAt ? [`Offerta valida fino al: ${formatDate(quote.offerExpiresAt)}`] : []),
    "",
    "Apri il preventivo:",
    quoteUrl,
    "",
    "Dal preventivo potrai visualizzare i dettagli, le condizioni e confermare online.",
    "",
    "Per domande puoi rispondere a questa email oppure scriverci su WhatsApp.",
    "",
    "Il team IschiaStars",
    "info@ischiastars.it"
  ].join("\n");

  const ok = await sendBrevoEmail({
    to: [{ email, name: clientName }],
    subject: `La tua proposta IschiaStars ${quote.code}`,
    html,
    text,
    replyTo: { email: replyEmail, name: replyName }
  });

  if (ok) {
    console.info(`[brevo] sent quote email ${quote.code}`);
  } else {
    console.warn(`[brevo] failed quote email ${quote.code} — check server logs`);
  }
}

export async function sendQuoteConfirmedInternalEmail(quote: Quote, confirmation: BrevoConfirmationDetails): Promise<void> {
  if (!isBrevoEnabled()) {
    console.info("[brevo] skipped: disabled");
    return;
  }

  const internalEmail = process.env.BREVO_INTERNAL_NOTIFY_EMAIL;
  if (!internalEmail) {
    console.warn(`[brevo] skipped internal confirmation ${quote.code}: BREVO_INTERNAL_NOTIFY_EMAIL not set`);
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const backofficeUrl = `${siteUrl}/admin/preventivi`;
  const hotelName = quote.proposedHotel?.name || "—";

  let confirmedAtFormatted = confirmation.confirmedAt;
  try {
    confirmedAtFormatted = new Date(confirmation.confirmedAt).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    // keep raw value
  }

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#1a4a2a;padding:22px 32px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">IschiaStars — Preventivo confermato</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 24px;">
            <p style="margin:0 0 24px;font-size:15px;color:#1a1a1a;line-height:1.6;">
              Il cliente ha confermato il preventivo online.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f0;border-radius:6px;padding:20px 20px 12px;margin-bottom:28px;">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Codice preventivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;font-weight:600;">${quote.code}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Cliente</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${confirmation.firstName} ${confirmation.lastName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Telefono</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${confirmation.phone}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Email</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${confirmation.email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Hotel</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${hotelName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Arrivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.arrivalDate)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Partenza</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.departureDate)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 6px;font-size:15px;border-top:1px solid #b8d8b8;"><strong>Prezzo totale</strong></td>
                <td style="padding:12px 0 6px;font-size:15px;font-weight:bold;color:#1a4a2a;text-align:right;border-top:1px solid #b8d8b8;">${formatPrice(quote.totalPrice)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Confermato il</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${confirmedAtFormatted}</td>
              </tr>
            </table>

            <div style="text-align:center;">
              <a href="${backofficeUrl}"
                 style="background:#1a3a5c;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">
                Apri backoffice preventivi
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#f0f9f0;padding:16px 32px;text-align:center;border-top:1px solid #c8e8c8;">
            <p style="margin:0;font-size:12px;color:#888;">Notifica automatica IschiaStars</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Preventivo confermato ${quote.code}`,
    "",
    "Il cliente ha confermato il preventivo online.",
    "",
    `Codice preventivo: ${quote.code}`,
    `Cliente:           ${confirmation.firstName} ${confirmation.lastName}`,
    `Telefono:          ${confirmation.phone}`,
    `Email:             ${confirmation.email}`,
    `Hotel:             ${hotelName}`,
    `Arrivo:            ${formatDate(quote.arrivalDate)}`,
    `Partenza:          ${formatDate(quote.departureDate)}`,
    `Prezzo totale:     ${formatPrice(quote.totalPrice)}`,
    `Confermato il:     ${confirmedAtFormatted}`,
    "",
    `Backoffice: ${backofficeUrl}`
  ].join("\n");

  const ok = await sendBrevoEmail({
    to: [{ email: internalEmail, name: "IschiaStars" }],
    subject: `Preventivo confermato ${quote.code}`,
    html,
    text
  });

  if (ok) {
    console.info(`[brevo] sent internal confirmation ${quote.code}`);
  } else {
    console.warn(`[brevo] failed internal confirmation ${quote.code} — check server logs`);
  }
}
