import type { Quote } from "@/lib/types";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";

type BrevoRecipient = { email: string; name?: string };

type SendBrevoEmailParams = {
  to: BrevoRecipient[];
  cc?: BrevoRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: BrevoRecipient;
};

export type BrevoConfirmationDetails = {
  firstName: string;
  lastName: string;
  fiscalCode: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  province: string;
  confirmedAt: string;
  children?: { id?: string; birthDate?: string }[];
  selectedHotelName?: string;
  selectedTreatmentLabel?: string;
  selectedPrice?: number;
  selectedDepositPercent?: number;
  selectedDepositAmount?: number;
  selectedBalanceAmount?: number;
  selectedBalanceMethod?: string;
  selectedPaymentPolicy?: string;
  selectedCancellationPolicy?: string;
  paymentSettingsSnapshot?: Record<string, unknown>;
};

export function isBrevoEnabled(): boolean {
  return process.env.BREVO_ENABLED === "true";
}

function brevoMissingEnvReason() {
  if (!isBrevoEnabled()) return "disabled";
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) return "missing_env";
  return null;
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
    ...(params.cc?.length ? { cc: params.cc } : {}),
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
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped quote email code=${quote.code} reason=disabled_or_missing_env detail=${missingEnvReason}`);
    return;
  }

  const email = quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn(`[brevo] skipped quote email code=${quote.code} reason=missing_client_email`);
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) {
    console.warn(`[brevo] skipped quote email code=${quote.code} reason=missing_site_url`);
    return;
  }
  const quoteUrl = `${siteUrl}/preventivi/${quote.code}?token=${quote.token}`;
  const firstName = quote.customerFirstName || "Cliente";
  const clientName = `${quote.customerFirstName} ${quote.customerLastName}`.trim();
  const replyEmail = process.env.BREVO_FROM_EMAIL || "info@ischiastars.it";
  const replyName = process.env.BREVO_FROM_NAME || "IschiaStars";

  const options = getEffectiveHotelOptions(quote);
  const hasMultiple = options.length > 1;

  // Riepilogo opzioni per email
  const optionsSummaryHtml = options
    .filter((o) => o.treatments.length > 0)
    .map((o) => {
      const treatmentsHtml = o.treatments
        .map((t) => `<tr><td style="padding:4px 0;font-size:13px;color:#555;">${t.label}</td><td style="padding:4px 0;font-size:13px;color:#1a3a5c;text-align:right;font-weight:600;">${formatPrice(t.price)}</td></tr>`)
        .join("");
      return `<tr><td colspan="2" style="padding:10px 0 4px;font-size:14px;font-weight:bold;color:#1a3a5c;">${o.hotelName}${o.hotelLocation ? ` — ${o.hotelLocation}` : ""}</td></tr>${treatmentsHtml}`;
    })
    .join("");

  const optionsSummaryText = options
    .filter((o) => o.treatments.length > 0)
    .map((o) => {
      const tr = o.treatments.map((t) => `  ${t.label}: ${formatPrice(t.price)}`).join("\n");
      return `${o.hotelName}${o.hotelLocation ? ` — ${o.hotelLocation}` : ""}:\n${tr}`;
    })
    .join("\n\n");

  const introText = hasMultiple
    ? `Abbiamo preparato <strong>più proposte</strong> per il tuo soggiorno a Ischia. Confronta le opzioni e conferma quella che preferisci direttamente online.`
    : `Abbiamo preparato la tua proposta personalizzata per il soggiorno a Ischia.`;

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
            <p style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.7;">${introText}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f6ff;border-radius:6px;padding:20px 20px 12px;margin-bottom:28px;">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Codice preventivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;font-weight:600;">${quote.code}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Arrivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.arrivalDate)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong style="color:#1a3a5c;">Partenza</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.departureDate)}</td>
              </tr>
              ${optionsSummaryHtml}
              ${quote.offerExpiresAt ? `<tr>
                <td style="padding:10px 0 6px;font-size:13px;color:#c05000;border-top:1px solid #cdd8e8;"><strong>Offerta valida fino al</strong></td>
                <td style="padding:10px 0 6px;font-size:13px;color:#c05000;text-align:right;font-weight:600;border-top:1px solid #cdd8e8;">${formatDate(quote.offerExpiresAt)}</td>
              </tr>` : ""}
            </table>

            <div style="text-align:center;margin:28px 0 20px;">
              <a href="${quoteUrl}"
                 style="background:#1a3a5c;color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;letter-spacing:0.5px;">
                ${hasMultiple ? "Vedi le proposte e conferma" : "Apri il preventivo"}
              </a>
            </div>

            <p style="text-align:center;margin:0 0 6px;font-size:12px;color:#999;">
              Se il pulsante non funziona, copia e incolla questo link nel browser:
            </p>
            <p style="text-align:center;margin:0 0 28px;font-size:12px;word-break:break-all;">
              <a href="${quoteUrl}" style="color:#1a3a5c;">${quoteUrl}</a>
            </p>

            <p style="margin:0 0 12px;font-size:14px;color:#444444;line-height:1.7;">
              Dal preventivo potrai visualizzare i dettagli, confrontare le proposte e confermare direttamente online.
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
    hasMultiple
      ? "Abbiamo preparato più proposte per il tuo soggiorno a Ischia."
      : "Abbiamo preparato la tua proposta personalizzata per il soggiorno a Ischia.",
    "",
    `Codice preventivo: ${quote.code}`,
    `Arrivo:            ${formatDate(quote.arrivalDate)}`,
    `Partenza:          ${formatDate(quote.departureDate)}`,
    "",
    "Proposte:",
    optionsSummaryText,
    ...(quote.offerExpiresAt ? [`\nOfferta valida fino al: ${formatDate(quote.offerExpiresAt)}`] : []),
    "",
    hasMultiple ? "Vedi le proposte e conferma:" : "Apri il preventivo:",
    quoteUrl,
    "",
    "Per domande puoi rispondere a questa email oppure scriverci su WhatsApp.",
    "",
    "Il team IschiaStars",
    "info@ischiastars.it"
  ].join("\n");

  const subject = hasMultiple
    ? `Le tue proposte IschiaStars ${quote.code}`
    : `La tua proposta IschiaStars ${quote.code}`;

  const ok = await sendBrevoEmail({
    to: [{ email, name: clientName }],
    subject,
    html,
    text,
    replyTo: { email: replyEmail, name: replyName }
  });

  if (ok) {
    console.info(`[brevo] sent quote email code=${quote.code}`);
  } else {
    console.warn(`[brevo] failed quote email code=${quote.code}`);
  }
}

export async function sendQuoteConfirmedInternalEmail(quote: Quote, confirmation: BrevoConfirmationDetails): Promise<void> {
  if (!isBrevoEnabled()) {
    console.info(`[brevo] skipped disabled internal confirmation code=${quote.code}`);
    return;
  }

  const internalEmail = process.env.BREVO_INTERNAL_NOTIFY_EMAIL;
  if (!internalEmail) {
    console.warn(`[brevo] skipped internal confirmation ${quote.code}: BREVO_INTERNAL_NOTIFY_EMAIL not set`);
    return;
  }
  const internalCcEmail = process.env.BREVO_INTERNAL_CC_EMAIL?.trim();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const backofficeUrl = `${siteUrl}/admin/preventivi`;

  let confirmedAtFormatted = confirmation.confirmedAt;
  try {
    confirmedAtFormatted = new Date(confirmation.confirmedAt).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch { /* keep raw value */ }

  const hasSelection = Boolean(confirmation.selectedHotelName && confirmation.selectedTreatmentLabel);
  const addressLine = [
    confirmation.address,
    confirmation.postalCode,
    confirmation.city,
    confirmation.province
  ].filter(Boolean).join(" ");
  const children = confirmation.children?.filter((child) => Boolean(child.birthDate)) ?? [];
  const childrenHtml = children.length
    ? children.map((child, index) => `<div>Bambino ${index + 1}: ${child.birthDate}</div>`).join("")
    : "-";
  const childrenText = children.length
    ? children.map((child, index) => `Bambino ${index + 1}: ${child.birthDate}`).join("; ")
    : "-";
  const selectionHtml = hasSelection
    ? `<tr>
        <td style="padding:10px 0 6px;font-size:15px;border-top:1px solid #b8d8b8;"><strong>Hotel scelto</strong></td>
        <td style="padding:10px 0 6px;font-size:15px;font-weight:bold;color:#1a4a2a;text-align:right;border-top:1px solid #b8d8b8;">${confirmation.selectedHotelName}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Trattamento scelto</strong></td>
        <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${confirmation.selectedTreatmentLabel}</td>
      </tr>
      ${confirmation.selectedPrice != null ? `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Prezzo scelto</strong></td>
        <td style="padding:6px 0;font-size:14px;font-weight:bold;color:#1a4a2a;text-align:right;">${formatPrice(confirmation.selectedPrice)}</td>
      </tr>` : ""}
      ${confirmation.selectedDepositPercent != null ? `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Acconto</strong></td>
        <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${confirmation.selectedDepositPercent}% pari a ${formatPrice(confirmation.selectedDepositAmount ?? 0)}</td>
      </tr>` : ""}
      ${confirmation.selectedBalanceAmount != null ? `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Saldo restante</strong></td>
        <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${formatPrice(confirmation.selectedBalanceAmount)}</td>
      </tr>` : ""}
      ${confirmation.selectedBalanceMethod ? `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Modalità saldo</strong></td>
        <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${confirmation.selectedBalanceMethod}</td>
      </tr>` : ""}
      ${confirmation.selectedCancellationPolicy ? `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Policy cancellazione</strong></td>
        <td style="padding:6px 0;font-size:13px;color:#1a4a2a;text-align:right;">${confirmation.selectedCancellationPolicy}</td>
      </tr>` : ""}`
    : `<tr>
        <td colspan="2" style="padding:10px 0 6px;font-size:13px;border-top:1px solid #b8d8b8;color:#888;">Il cliente non ha specificato l'opzione (conferma generica)</td>
      </tr>`;
  const paymentSnapshot = confirmation.paymentSettingsSnapshot ?? {};
  const paymentConfigured = paymentSnapshot.configured === true;
  const paymentReason = typeof paymentSnapshot.payment_reason === "string" ? paymentSnapshot.payment_reason : "";
  const paymentCoordinatesHtml = paymentConfigured
    ? `<tr>
        <td style="padding:10px 0 6px;font-size:14px;color:#555;border-top:1px solid #b8d8b8;"><strong>Coordinate comunicate</strong></td>
        <td style="padding:10px 0 6px;font-size:13px;color:#1a4a2a;text-align:right;border-top:1px solid #b8d8b8;">
          ${paymentSnapshot.bank_account_holder ? `Intestatario: ${paymentSnapshot.bank_account_holder}<br>` : ""}
          ${paymentSnapshot.bank_name ? `Banca: ${paymentSnapshot.bank_name}<br>` : ""}
          ${paymentSnapshot.iban ? `IBAN: ${paymentSnapshot.iban}<br>` : ""}
          ${paymentSnapshot.bic_swift ? `BIC/SWIFT: ${paymentSnapshot.bic_swift}<br>` : ""}
          ${paymentReason ? `Causale: ${paymentReason}` : ""}
        </td>
      </tr>`
    : `<tr>
        <td style="padding:10px 0 6px;font-size:14px;color:#555;border-top:1px solid #b8d8b8;"><strong>Coordinate comunicate</strong></td>
        <td style="padding:10px 0 6px;font-size:13px;color:#888;text-align:right;border-top:1px solid #b8d8b8;">Non configurate: pagamento comunicato dallo staff.</td>
      </tr>`;
  const paymentCoordinatesText = paymentConfigured
    ? [
        paymentSnapshot.bank_account_holder ? `Intestatario:      ${paymentSnapshot.bank_account_holder}` : null,
        paymentSnapshot.bank_name ? `Banca:             ${paymentSnapshot.bank_name}` : null,
        paymentSnapshot.iban ? `IBAN:              ${paymentSnapshot.iban}` : null,
        paymentSnapshot.bic_swift ? `BIC/SWIFT:         ${paymentSnapshot.bic_swift}` : null,
        paymentReason ? `Causale:           ${paymentReason}` : null
      ].filter(Boolean) as string[]
    : ["Coordinate:        non configurate, pagamento comunicato dallo staff"];

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
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Codice fiscale</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${confirmation.fiscalCode}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Indirizzo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${addressLine || "-"}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Bambini</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${childrenHtml}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Arrivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.arrivalDate)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Partenza</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${formatDate(quote.departureDate)}</td>
              </tr>
              ${selectionHtml}
              ${paymentCoordinatesHtml}
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
    `Codice fiscale:    ${confirmation.fiscalCode}`,
    `Indirizzo:         ${addressLine || "-"}`,
    `Bambini:           ${childrenText}`,
    `Arrivo:            ${formatDate(quote.arrivalDate)}`,
    `Partenza:          ${formatDate(quote.departureDate)}`,
    ...(confirmation.selectedHotelName ? [`Hotel scelto:      ${confirmation.selectedHotelName}`] : []),
    ...(confirmation.selectedTreatmentLabel ? [`Trattamento:       ${confirmation.selectedTreatmentLabel}`] : []),
    ...(confirmation.selectedPrice != null ? [`Prezzo scelto:     ${formatPrice(confirmation.selectedPrice)}`] : []),
    ...(confirmation.selectedDepositPercent != null ? [`Acconto:          ${confirmation.selectedDepositPercent}% pari a ${formatPrice(confirmation.selectedDepositAmount ?? 0)}`] : []),
    ...(confirmation.selectedBalanceAmount != null ? [`Saldo restante:   ${formatPrice(confirmation.selectedBalanceAmount)}`] : []),
    ...(confirmation.selectedBalanceMethod ? [`Modalità saldo:    ${confirmation.selectedBalanceMethod}`] : []),
    ...(confirmation.selectedCancellationPolicy ? [`Policy canc.:      ${confirmation.selectedCancellationPolicy}`] : []),
    ...paymentCoordinatesText,
    `Confermato il:     ${confirmedAtFormatted}`,
    "",
    `Backoffice: ${backofficeUrl}`
  ].join("\n");

  const ok = await sendBrevoEmail({
    to: [{ email: internalEmail, name: "IschiaStars" }],
    cc: internalCcEmail ? [{ email: internalCcEmail, name: "IschiaStars Preventivi" }] : undefined,
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

export type FinalConfirmationEmailDetails = {
  depositDueAt: string;
  notes?: string;
  paymentSettingsSnapshot?: Record<string, unknown>;
};

export type AvailabilityUnavailableEmailDetails = {
  reason?: string;
  message: string;
};

export async function sendFinalConfirmationEmailToClient(quote: Quote, details: FinalConfirmationEmailDetails): Promise<boolean> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped final confirmation code=${quote.code} reason=${missingEnvReason}`);
    return false;
  }

  const email = quote.confirmation?.selectedHotelName ? quote.customerEmail?.trim() : quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const confirmation = quote.confirmation;
  const snapshot = details.paymentSettingsSnapshot ?? confirmation?.paymentSettingsSnapshot ?? {};
  const paymentReason = typeof snapshot.payment_reason === "string" ? snapshot.payment_reason : "";
  const dueAt = formatDateTimeForEmail(details.depositDueAt);
  const firstName = quote.customerFirstName || "Cliente";

  const coordinatesHtml = snapshot.configured === true
    ? `<p><strong>Coordinate caparra</strong><br>
        ${snapshot.bank_account_holder ? `Intestatario: ${snapshot.bank_account_holder}<br>` : ""}
        ${snapshot.bank_name ? `Banca: ${snapshot.bank_name}<br>` : ""}
        ${snapshot.iban ? `IBAN: ${snapshot.iban}<br>` : ""}
        ${snapshot.bic_swift ? `BIC/SWIFT: ${snapshot.bic_swift}<br>` : ""}
        ${paymentReason ? `Causale: ${paymentReason}<br>` : ""}
      </p>`
    : `<p>Le modalità operative per il versamento della caparra saranno comunicate dallo staff IschiaStars.</p>`;

  const html = `<!DOCTYPE html><html lang="it"><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a4a2a;padding:22px 32px;color:#fff;font-weight:bold;font-size:18px;">Conferma definitiva IschiaStars</td></tr>
        <tr><td style="padding:28px 32px;color:#333;font-size:15px;line-height:1.7;">
          <p>Ciao ${firstName},</p>
          <p>la struttura ha confermato la disponibilità per la proposta selezionata. Per bloccare definitivamente il soggiorno è necessario versare la caparra entro <strong>${dueAt}</strong>.</p>
          <p><strong>Hotel:</strong> ${confirmation?.selectedHotelName ?? quote.proposedHotel.name}<br>
          <strong>Trattamento:</strong> ${confirmation?.selectedTreatmentLabel ?? quote.treatment}<br>
          <strong>Prezzo totale:</strong> ${confirmation?.selectedPrice != null ? formatPrice(confirmation.selectedPrice) : formatPrice(quote.totalPrice)}<br>
          ${confirmation?.selectedDepositPercent != null ? `<strong>Caparra:</strong> ${confirmation.selectedDepositPercent}% pari a ${formatPrice(confirmation.selectedDepositAmount ?? 0)}<br>` : ""}
          ${confirmation?.selectedBalanceAmount != null ? `<strong>Saldo restante:</strong> ${formatPrice(confirmation.selectedBalanceAmount)}<br>` : ""}
          ${confirmation?.selectedBalanceMethod ? `<strong>Modalità saldo:</strong> ${confirmation.selectedBalanceMethod}` : ""}</p>
          ${coordinatesHtml}
          ${confirmation?.selectedCancellationPolicy ? `<p><strong>Policy cancellazione:</strong> ${confirmation.selectedCancellationPolicy}</p>` : ""}
          ${details.notes ? `<p><strong>Note:</strong> ${details.notes}</p>` : ""}
          <p>Per qualsiasi dubbio puoi rispondere a questa email o scriverci su WhatsApp.</p>
          <p>IschiaStars</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Conferma definitiva IschiaStars ${quote.code}`,
    "",
    `Ciao ${firstName},`,
    "",
    `La struttura ha confermato la disponibilità. Versa la caparra entro ${dueAt}.`,
    `Hotel: ${confirmation?.selectedHotelName ?? quote.proposedHotel.name}`,
    `Trattamento: ${confirmation?.selectedTreatmentLabel ?? quote.treatment}`,
    `Prezzo totale: ${confirmation?.selectedPrice != null ? formatPrice(confirmation.selectedPrice) : formatPrice(quote.totalPrice)}`,
    ...(confirmation?.selectedDepositPercent != null ? [`Caparra: ${confirmation.selectedDepositPercent}% pari a ${formatPrice(confirmation.selectedDepositAmount ?? 0)}`] : []),
    ...(confirmation?.selectedBalanceAmount != null ? [`Saldo restante: ${formatPrice(confirmation.selectedBalanceAmount)}`] : []),
    ...(confirmation?.selectedBalanceMethod ? [`Modalità saldo: ${confirmation.selectedBalanceMethod}`] : []),
    ...(snapshot.configured === true ? [
      snapshot.bank_account_holder ? `Intestatario: ${snapshot.bank_account_holder}` : "",
      snapshot.bank_name ? `Banca: ${snapshot.bank_name}` : "",
      snapshot.iban ? `IBAN: ${snapshot.iban}` : "",
      snapshot.bic_swift ? `BIC/SWIFT: ${snapshot.bic_swift}` : "",
      paymentReason ? `Causale: ${paymentReason}` : ""
    ].filter(Boolean) : ["Le modalità operative per il versamento della caparra saranno comunicate dallo staff IschiaStars."]),
    ...(confirmation?.selectedCancellationPolicy ? [`Policy cancellazione: ${confirmation.selectedCancellationPolicy}`] : []),
    ...(details.notes ? [`Note: ${details.notes}`] : []),
    "",
    "IschiaStars"
  ].join("\n");

  return sendBrevoEmail({
    to: [{ email, name: `${quote.customerFirstName} ${quote.customerLastName}`.trim() }],
    subject: `Conferma definitiva soggiorno - ${quote.code}`,
    html,
    text,
    replyTo: { email: process.env.BREVO_FROM_EMAIL || "info@ischiastars.it", name: process.env.BREVO_FROM_NAME || "IschiaStars" }
  });
}

export async function sendAvailabilityUnavailableEmailToClient(quote: Quote, details: AvailabilityUnavailableEmailDetails): Promise<boolean> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped unavailable email code=${quote.code} reason=${missingEnvReason}`);
    return false;
  }

  const email = quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const messageHtml = details.message.split("\n").map((line) => line.trim() ? `<p>${line}</p>` : "").join("");

  const html = `<!DOCTYPE html><html lang="it"><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a3a5c;padding:22px 32px;color:#fff;font-weight:bold;font-size:18px;">Aggiornamento disponibilità struttura</td></tr>
        <tr><td style="padding:28px 32px;color:#333;font-size:15px;line-height:1.7;">
          ${messageHtml}
          <p><strong>Preventivo:</strong> ${quote.code}<br>
          <strong>Hotel selezionato:</strong> ${quote.confirmation?.selectedHotelName ?? quote.proposedHotel.name}<br>
          <strong>Date:</strong> ${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}<br>
          <strong>Trattamento:</strong> ${quote.confirmation?.selectedTreatmentLabel ?? quote.treatment}</p>
          ${details.reason ? `<p><strong>Nota:</strong> ${details.reason}</p>` : ""}
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    details.message,
    "",
    `Preventivo: ${quote.code}`,
    `Hotel selezionato: ${quote.confirmation?.selectedHotelName ?? quote.proposedHotel.name}`,
    `Date: ${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`,
    `Trattamento: ${quote.confirmation?.selectedTreatmentLabel ?? quote.treatment}`,
    ...(details.reason ? [`Nota: ${details.reason}`] : [])
  ].join("\n");

  return sendBrevoEmail({
    to: [{ email, name: `${quote.customerFirstName} ${quote.customerLastName}`.trim() }],
    subject: `Aggiornamento disponibilità struttura - ${quote.code}`,
    html,
    text,
    replyTo: { email: process.env.BREVO_FROM_EMAIL || "info@ischiastars.it", name: process.env.BREVO_FROM_NAME || "IschiaStars" }
  });
}

function formatDateTimeForEmail(value: string) {
  try {
    return new Date(value).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}
