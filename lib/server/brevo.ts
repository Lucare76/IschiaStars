import type { Quote, QuoteConfirmation } from "@/lib/types";
import { logEmailAttempt } from "@/lib/repositories/emailLogs";
import { formatConfirmationAdditionalService, getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { listExtraServiceEmailItems } from "@/lib/repositories/extraServiceEmailItems";
import { getFeatureFlags } from "@/lib/repositories/settings";
import { getEffectiveBalancePaymentSchedule } from "@/lib/hotel-policies";
import { absoluteShortPublicQuoteUrl, ischiastarsWhatsappNumber } from "@/lib/utils";

type BrevoRecipient = { email: string; name?: string };

type BrevoAttachment = { name: string; content: string };

type SendBrevoEmailParams = {
  to: BrevoRecipient[];
  cc?: BrevoRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: BrevoRecipient;
  attachment?: BrevoAttachment[];
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
  children?: { id?: string; birthDate?: string; declaredAge?: number; calculatedAge?: number; ageMismatch?: boolean }[];
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

type BrevoSendResult = {
  ok: boolean;
  status?: number;
  error?: string;
  messageId?: string;
};

export function isBrevoEnabled(): boolean {
  return process.env.BREVO_ENABLED === "true";
}

function brevoMissingEnvReason() {
  if (!isBrevoEnabled()) return "disabled";
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) return "missing_env";
  return null;
}

async function sendBrevoEmailWithResult(params: SendBrevoEmailParams): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "IschiaStars";

  if (!apiKey || !fromEmail) {
    console.error("[brevo] missing API key or sender email — check BREVO_API_KEY and BREVO_FROM_EMAIL");
    return { ok: false, error: "missing_env" };
  }

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: params.to,
    ...(params.cc?.length ? { cc: params.cc } : {}),
    subject: params.subject,
    htmlContent: params.html,
    ...(params.text ? { textContent: params.text } : {}),
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.attachment?.length ? { attachment: params.attachment } : {})
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

    if (response.ok) {
      let messageId: string | undefined;
      try {
        const json = await response.json();
        if (typeof json?.messageId === "string") messageId = json.messageId;
      } catch { /* body not parsable — not critical */ }
      return { ok: true, status: response.status, messageId };
    }

    const body = await response.text().catch(() => "(unreadable)");
    console.error(`[brevo] API error status=${response.status} message=${body.slice(0, 300)}`);
    return { ok: false, status: response.status, error: body.slice(0, 300) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[brevo] fetch error:", message);
    return { ok: false, error: message };
  }
}

export async function sendBrevoEmail(params: SendBrevoEmailParams): Promise<boolean> {
  return (await sendBrevoEmailWithResult(params)).ok;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatDateDayMonth(iso: string): string {
  try {
    const date = new Date(iso);
    const day = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric" }).format(date);
    const month = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long" }).format(date);
    return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  } catch {
    return iso;
  }
}

function formatDateDayMonthYear(iso: string): string {
  try {
    const date = new Date(iso);
    const day = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric" }).format(date);
    const month = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long" }).format(date);
    const year = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric" }).format(date);
    return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
  } catch {
    return iso;
  }
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

function formatPriceFrom(amount: number): string {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function safeEmailUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "#";
    return escapeHtmlAttribute(url.toString());
  } catch {
    return "#";
  }
}

function paymentCopyFieldHtml(label: string, value: string, helper: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D9E2EC;border-radius:10px;background:#FFFFFF;margin:8px 0 10px;">
    <tr>
      <td style="padding:10px 12px 4px;">
        <span style="display:inline-block;border:1px solid #1B3A5C;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:bold;color:#1B3A5C;background:#F8FAFC;">${escapeHtml(helper)}</span>
        <span style="display:inline-block;margin-left:6px;font-size:11px;font-weight:bold;color:#6B7280;text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(label)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:0 12px 11px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:15px;line-height:1.5;font-weight:bold;color:#111827;word-break:break-word;user-select:all;-webkit-user-select:all;">${escapeHtml(value)}</td>
    </tr>
  </table>`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "invalid";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function emailSharedStyles(): string {
  return `<style>
    @media only screen and (max-width: 480px) {
      .email-wrapper { padding: 12px 0 !important; }
      .email-container { width: 100% !important; }
      .email-body { padding: 16px !important; }
      .section-title { font-size: 18px !important; }
      .cta-button { width: 100% !important; display: block !important; box-sizing: border-box; }
      .header-padding { padding: 20px 16px !important; }
      .footer-padding { padding: 14px 16px !important; }
      .travel-service-name, .travel-service-price { display: block !important; width: auto !important; text-align: left !important; }
      .travel-service-price { padding: 2px 0 10px 26px !important; }
    }
  </style>`;
}

export type SendQuoteEmailResult = { sent: boolean; skipReason?: string };

export async function sendQuoteEmailToClient(quote: Quote): Promise<SendQuoteEmailResult> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped quote email code=${quote.code} reason=disabled_or_missing_env detail=${missingEnvReason}`);
    return { sent: false, skipReason: missingEnvReason };
  }

  const email = quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn(`[brevo] skipped quote email code=${quote.code} reason=missing_client_email`);
    return { sent: false, skipReason: "missing_client_email" };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) {
    console.warn(`[brevo] skipped quote email code=${quote.code} reason=missing_site_url`);
    return { sent: false, skipReason: "missing_site_url" };
  }
  const quoteUrl = `${siteUrl}/preventivi/${quote.code}/${quote.token}?source=email`;
  const logoUrl = `${siteUrl}/ischiastars-logo.png`;
  const firstName = quote.customerFirstName || "Cliente";
  const clientName = `${quote.customerFirstName} ${quote.customerLastName}`.trim();
  const replyEmail = process.env.BREVO_FROM_EMAIL || "info@ischiastars.it";
  const replyName = process.env.BREVO_FROM_NAME || "IschiaStars";

  const options = getEffectiveHotelOptions(quote);
  const hasMultiple = options.length > 1;
  const featureFlags = (await getFeatureFlags()).data;
  const travelServices = featureFlags.emailTravelServicesBox
    ? (await listExtraServiceEmailItems(true)).data
    : [];

  const travelServicesBoxHtml = travelServices.length ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fc;border:1px solid #d9e5ef;border-radius:10px;margin:28px 0 24px;">
              <tr>
                <td style="padding:22px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#0b67a3;">Organizza anche il viaggio</p>
                  <p class="section-title" style="margin:0 0 9px;font-size:19px;font-weight:bold;color:#1a3a5c;line-height:1.3;">Vuoi arrivare a Ischia senza pensieri?</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.65;">Oltre al soggiorno, possiamo aiutarti a scegliere il collegamento più comodo per raggiungere la struttura.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d9e5ef;">
                    ${travelServices.map((item, index) => `
                    <tr>
                      <td valign="top" style="width:20px;padding:11px 0;font-size:13px;color:#0b67a3;${index ? "border-top:1px solid #e4ecf3;" : ""}">&#10003;</td>
                      <td class="travel-service-name" style="padding:11px 8px 11px 0;font-size:14px;font-weight:600;color:#374151;line-height:1.45;${index ? "border-top:1px solid #e4ecf3;" : ""}">
                        ${escapeHtml(item.title)}
                        ${item.description ? `<br><span style="font-size:12px;color:#6b7280;">${escapeHtml(item.description)}</span>` : ""}
                      </td>
                      <td class="travel-service-price" valign="top" style="padding:11px 0;font-size:14px;color:#1a3a5c;text-align:right;font-weight:bold;white-space:nowrap;${index ? "border-top:1px solid #e4ecf3;" : ""}">da € ${formatPriceFrom(item.priceFrom)} <span style="font-size:12px;font-weight:normal;color:#60758a;">${escapeHtml(item.priceSuffix)}</span></td>
                    </tr>`).join("")}
                  </table>
                  <p style="margin:16px 0 0;padding-top:14px;border-top:1px solid #d9e5ef;font-size:12px;color:#66717d;line-height:1.65;">Le tariffe sono indicative e possono variare in base a data, disponibilità e orari.</p>
                  <p style="margin:9px 0 0;font-size:13px;font-weight:600;color:#1a3a5c;line-height:1.55;">Rispondi a questa email o scrivici su WhatsApp: ti consiglieremo la soluzione più adatta al tuo viaggio.</p>
                </td>
              </tr>
            </table>` : "";

  const travelServicesBoxText = travelServices.length ? [
    "Vuoi arrivare a Ischia senza pensieri?",
    "",
    "Oltre al soggiorno, possiamo aiutarti anche a organizzare il collegamento più comodo per raggiungere la struttura:",
    ...travelServices.map((item) => `• ${item.title}: da € ${formatPriceFrom(item.priceFrom)} ${item.priceSuffix}${item.description ? ` — ${item.description}` : ""}`),
    "",
    "Le tariffe sono indicative e possono variare in base a data, disponibilità e orari. Per ricevere la soluzione più adatta al tuo viaggio, rispondi a questa email o contattaci su WhatsApp."
  ].join("\n") : "";

  // Riepilogo opzioni per email
  const optionsSummaryHtml = options
    .filter((o) => o.treatments.length > 0)
    .map((o) => {
      const treatmentsHtml = o.treatments
        .map((t) => `<tr><td style="padding:4px 0;font-size:13px;color:#555;">${escapeHtml(t.label)}</td><td style="padding:4px 0;font-size:13px;color:#1a3a5c;text-align:right;font-weight:600;">${formatPrice(t.price)}</td></tr>`)
        .join("");
      return `<tr><td colspan="2" style="padding:10px 0 4px;font-size:14px;font-weight:bold;color:#1a3a5c;">${escapeHtml(o.hotelName)}${o.hotelLocation ? ` — ${escapeHtml(o.hotelLocation)}` : ""}</td></tr>${treatmentsHtml}`;
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

  const nights = Math.round((new Date(quote.departureDate).getTime() - new Date(quote.arrivalDate).getTime()) / (1000 * 60 * 60 * 24));
  const adultsLabel = `${quote.adults} adult${quote.adults === 1 ? "o" : "i"}`;
  const childCount = quote.children.length;
  const guestsLabel = childCount > 0
    ? `${adultsLabel}, ${childCount} bambin${childCount === 1 ? "o" : "i"}`
    : adultsLabel;
  const firstRoomType = options[0]?.roomTypeLabel?.trim() || "";
  const uniqueGroups = new Set(options.map(o => o.hotelGroup));
  const primaryHotelName = options[0]?.hotelName ?? "";
  const hotelSummaryLabel = uniqueGroups.size > 1
    ? `${primaryHotelName} + altri ${uniqueGroups.size - 1} hotel`
    : primaryHotelName;

  const staySummaryBoxHtml = `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;border:1px solid #E5E7EB;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:14px 18px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:3px 0;font-size:14px;color:#374151;">🗓 ${formatDateDayMonth(quote.arrivalDate)} → ${formatDateDayMonthYear(quote.departureDate)}</td></tr>
                  <tr><td style="padding:3px 0;font-size:14px;color:#374151;">🌙 ${nights} nott${nights === 1 ? "e" : "i"}</td></tr>
                  <tr><td style="padding:3px 0;font-size:14px;color:#374151;">👥 ${guestsLabel}</td></tr>
                  ${firstRoomType ? `<tr><td style="padding:3px 0;font-size:14px;color:#374151;">🛏 ${escapeHtml(firstRoomType)}</td></tr>` : ""}
                  ${hotelSummaryLabel ? `<tr><td style="padding:3px 0;font-size:14px;color:#374151;">🏨 ${escapeHtml(hotelSummaryLabel)}</td></tr>` : ""}
                </table>
              </td></tr>
            </table>`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td class="header-padding" style="background:#1a3a5c;padding:28px 32px;text-align:center;">
            <img src="${safeEmailUrl(logoUrl)}" alt="IschiaStars" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 auto 8px;">
            <p class="section-title" style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;">Preventivi IschiaStars</p>
            <p style="margin:6px 0 0;color:#a8c4e0;font-size:13px;">Soggiorni a Ischia</p>
          </td>
        </tr>

        <tr>
          <td class="email-body" style="padding:28px 32px 24px;">
            <p style="margin:0 0 18px;font-size:15px;color:#1F2937;line-height:1.6;">Ciao ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">${introText}</p>

            ${staySummaryBoxHtml}

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
              <a href="${safeEmailUrl(quoteUrl)}" class="cta-button"
                 style="background:#1a3a5c;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;letter-spacing:0.5px;">
                ${hasMultiple ? "Vedi le proposte e conferma" : "Apri il preventivo"}
              </a>
            </div>

            <p style="text-align:center;margin:0 0 6px;font-size:12px;color:#999;">
              Se il pulsante non funziona, copia e incolla questo link nel browser:
            </p>
            <p style="text-align:center;margin:0 0 28px;font-size:12px;word-break:break-all;">
              <a href="${safeEmailUrl(quoteUrl)}" style="color:#1a3a5c;">${escapeHtml(quoteUrl)}</a>
            </p>

            ${travelServicesBoxHtml}

            <p style="margin:0 0 12px;font-size:14px;color:#444444;line-height:1.7;">
              Dal preventivo potrai visualizzare i dettagli, confrontare le proposte e confermare direttamente online.
            </p>
            <p style="margin:0;font-size:14px;color:#444444;line-height:1.7;">
              Per domande puoi rispondere a questa email oppure scriverci su WhatsApp.
            </p>
          </td>
        </tr>

        <tr>
          <td class="footer-padding" style="background:#f0f6ff;padding:20px 32px;text-align:center;border-top:1px solid #e0e8f0;">
            <p style="margin:0;font-size:13px;color:#666;">Il team IschiaStars</p>
            <p style="margin:4px 0 0;font-size:12px;color:#999;">info@ischiastars.it</p>
          </td>
        </tr>

  </table>
  </div>
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
    ...(travelServicesBoxText ? [travelServicesBoxText, ""] : []),
    "Per domande puoi rispondere a questa email oppure scriverci su WhatsApp.",
    "",
    "Il team IschiaStars",
    "info@ischiastars.it"
  ].join("\n");

  const subject = hasMultiple
    ? `Le tue proposte IschiaStars ${quote.code}`
    : `La tua proposta IschiaStars ${quote.code}`;

  console.info(`[brevo] sending quote email code=${quote.code} to=${maskEmail(email)}`);
  const sendResult = await sendBrevoEmailWithResult({
    to: [{ email, name: clientName }],
    subject,
    html,
    text,
    replyTo: { email: replyEmail, name: replyName }
  });

  if (sendResult.ok) {
    console.info(`[brevo] sent quote email code=${quote.code}`);
    await logEmailAttempt({ quoteId: quote.id, emailType: "quote_to_client", recipientEmail: email, subject, brevoMessageId: sendResult.messageId, ok: true });
    return { sent: true };
  } else {
    console.warn(`[brevo] failed quote email code=${quote.code} status=${sendResult.status ?? "fetch_error"} error=${sendResult.error ?? "-"}`);
    await logEmailAttempt({ quoteId: quote.id, emailType: "quote_to_client", recipientEmail: email, subject, ok: false, errorMessage: sendResult.error });
    return { sent: false, skipReason: `brevo_error_${sendResult.status ?? "fetch"}` };
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
      timeZone: "Europe/Rome",
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
  const children = confirmation.children ?? [];
  const childrenHtml = children.length
    ? children.map((child, index) => {
        const parts: string[] = [`Bambino ${index + 1}:`];
        if (child.declaredAge != null) parts.push(`età preventivo ${child.declaredAge} anni`);
        if (child.birthDate) parts.push(`nato il ${escapeHtml(child.birthDate)}`);
        if (child.calculatedAge != null) parts.push(`→ ${child.calculatedAge} anni al check-in`);
        const line = `<div>${parts.join(" — ")}${child.ageMismatch ? " <strong style='color:#b45309'>⚠ età non coerente</strong>" : ""}</div>`;
        return line;
      }).join("")
    : "-";
  const childrenText = children.length
    ? children.map((child, index) => {
        const parts: string[] = [`Bambino ${index + 1}:`];
        if (child.declaredAge != null) parts.push(`età preventivo ${child.declaredAge} anni`);
        if (child.birthDate) parts.push(`nato il ${child.birthDate}`);
        if (child.calculatedAge != null) parts.push(`→ ${child.calculatedAge} anni al check-in`);
        if (child.ageMismatch) parts.push("ATTENZIONE: età non coerente con il preventivo");
        return parts.join(" — ");
      }).join("; ")
    : "-";
  const selectionHtml = hasSelection
    ? `<tr>
        <td style="padding:10px 0 6px;font-size:15px;border-top:1px solid #b8d8b8;"><strong>Hotel scelto</strong></td>
        <td style="padding:10px 0 6px;font-size:15px;font-weight:bold;color:#1a4a2a;text-align:right;border-top:1px solid #b8d8b8;">${escapeHtml(confirmation.selectedHotelName!)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Trattamento scelto</strong></td>
        <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${escapeHtml(confirmation.selectedTreatmentLabel!)}</td>
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
        <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${escapeHtml(confirmation.selectedBalanceMethod)}</td>
      </tr>` : ""}
      ${confirmation.selectedCancellationPolicy ? `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Policy cancellazione</strong></td>
        <td style="padding:6px 0;font-size:13px;color:#1a4a2a;text-align:right;">${escapeHtml(confirmation.selectedCancellationPolicy)}</td>
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
          ${paymentSnapshot.bank_account_holder ? `Intestatario: ${escapeHtml(String(paymentSnapshot.bank_account_holder))}<br>` : ""}
          ${paymentSnapshot.bank_name ? `Banca: ${escapeHtml(String(paymentSnapshot.bank_name))}<br>` : ""}
          ${paymentSnapshot.iban ? `IBAN: ${escapeHtml(String(paymentSnapshot.iban))}<br>` : ""}
          ${paymentSnapshot.bic_swift ? `BIC/SWIFT: ${escapeHtml(String(paymentSnapshot.bic_swift))}<br>` : ""}
          ${paymentReason ? `Causale: ${escapeHtml(paymentReason)}` : ""}
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
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td class="header-padding" style="background:#1a4a2a;padding:22px 32px;">
            <p class="section-title" style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">IschiaStars — Preventivo confermato</p>
          </td>
        </tr>

        <tr>
          <td class="email-body" style="padding:28px 32px 24px;">
            <p style="margin:0 0 24px;font-size:15px;color:#1F2937;line-height:1.6;">
              Il cliente ha confermato il preventivo online.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f0;border-radius:6px;padding:20px 20px 12px;margin-bottom:28px;">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Codice preventivo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;font-weight:600;">${quote.code}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Cliente</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${escapeHtml(confirmation.firstName)} ${escapeHtml(confirmation.lastName)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Telefono</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${escapeHtml(confirmation.phone)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Email</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${escapeHtml(confirmation.email)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Codice fiscale</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${escapeHtml(confirmation.fiscalCode)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Indirizzo</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#222;text-align:right;">${escapeHtml(addressLine || "-")}</td>
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
                <td style="padding:6px 0;font-size:14px;color:#1a4a2a;text-align:right;font-weight:600;">${escapeHtml(confirmedAtFormatted)}</td>
              </tr>
            </table>

            <div style="text-align:center;">
              <a href="${safeEmailUrl(backofficeUrl)}" class="cta-button"
                 style="background:#1a3a5c;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">
                Apri backoffice preventivi
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td class="footer-padding" style="background:#f0f9f0;padding:16px 32px;text-align:center;border-top:1px solid #c8e8c8;">
            <p style="margin:0;font-size:12px;color:#888;">Notifica automatica IschiaStars</p>
          </td>
        </tr>

  </table>
  </div>
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

  const internalSubject = `Preventivo confermato ${quote.code}`;
  const internalResult = await sendBrevoEmailWithResult({
    to: [{ email: internalEmail, name: "IschiaStars" }],
    cc: internalCcEmail ? [{ email: internalCcEmail, name: "IschiaStars Preventivi" }] : undefined,
    subject: internalSubject,
    html,
    text
  });

  if (internalResult.ok) {
    console.info(`[brevo] sent internal confirmation ${quote.code}`);
  } else {
    console.warn(`[brevo] failed internal confirmation ${quote.code} — check server logs`);
  }
  await logEmailAttempt({ quoteId: quote.id, emailType: "confirmation_internal", recipientEmail: internalEmail, subject: internalSubject, brevoMessageId: internalResult.messageId, ok: internalResult.ok, errorMessage: internalResult.error });
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

function buildFinalConfirmationEmailHtml(quote: Quote, details: FinalConfirmationEmailDetails) {
  const confirmation = quote.confirmation;
  const snapshot = details.paymentSettingsSnapshot ?? confirmation?.paymentSettingsSnapshot ?? {};
  const paymentReason = typeof snapshot.payment_reason === "string" ? snapshot.payment_reason : "";
  const firstName = quote.customerFirstName || "Cliente";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const logoUrl = siteUrl ? `${siteUrl}/ischiastars-logo.png` : "";
  const hotelName = confirmation?.selectedHotelName ?? quote.proposedHotel.name;
  const treatmentLabel = confirmation?.selectedTreatmentLabel ?? quote.treatment;
  const arrivalLabel = formatDate(quote.arrivalDate);
  const departureLabel = formatDate(quote.departureDate);
  const totalPriceLabel = confirmation?.selectedPrice != null ? formatPrice(confirmation.selectedPrice) : formatPrice(quote.totalPrice);
  const depositLabel = confirmation?.selectedDepositAmount != null ? formatPrice(confirmation.selectedDepositAmount) : "";
  const balanceLabel = confirmation?.selectedBalanceAmount != null ? formatPrice(confirmation.selectedBalanceAmount) : "";
  const balanceSchedule = getEffectiveBalancePaymentSchedule({
    balanceMethod: confirmation?.selectedBalanceMethod,
    arrivalDate: quote.arrivalDate,
    hotelName
  });
  const balanceDueLabel = balanceSchedule.dueDate ? formatDate(balanceSchedule.dueDate) : "";
  const balanceInstruction = balanceLabel
    ? balanceDueLabel
      ? `Il saldo restante di <strong style="color:#1B3A5C;">${balanceLabel}</strong> dovrà essere versato entro il <strong style="color:#1B3A5C;">${balanceDueLabel}</strong>.`
      : balanceSchedule.type === "in_structure"
        ? `Il saldo restante di <strong style="color:#1B3A5C;">${balanceLabel}</strong> dovrà essere versato in struttura.`
        : `Il saldo restante è di <strong style="color:#1B3A5C;">${balanceLabel}</strong>.`
    : "";
  const additionalServices = getConfirmationAdditionalServices(confirmation?.metadata);
  const additionalServicesHtml = additionalServices.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;border:1px solid #D9E2EC;border-radius:10px;margin:0 0 22px;"><tr><td style="padding:16px 18px;font-size:13px;color:#374151;"><strong>Servizi aggiuntivi</strong><br>${additionalServices.map((service) => escapeHtml(formatConfirmationAdditionalService(service))).join("<br>")}</td></tr></table>`
    : "";

  const coordinatesHtml = snapshot.configured === true
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;border:1px solid #D9E2EC;border-radius:10px;margin:0 0 22px;">
        <tr><td style="padding:16px 18px;">
          <div style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.5px;">Coordinate caparra</div>
          ${snapshot.bank_account_holder ? `<div style="margin:0 0 5px;font-size:14px;color:#374151;"><strong>Intestatario:</strong> ${escapeHtml(String(snapshot.bank_account_holder))}</div>` : ""}
          ${snapshot.bank_name ? `<div style="margin:0 0 5px;font-size:14px;color:#374151;"><strong>Banca:</strong> ${escapeHtml(String(snapshot.bank_name))}</div>` : ""}
          ${snapshot.iban ? paymentCopyFieldHtml("IBAN", String(snapshot.iban), "Copia IBAN") : ""}
          ${snapshot.iban ? `<div style="margin:0 0 5px;font-size:13px;font-weight:bold;color:#1B3A5C;">La quinta lettera è la I di Imola.</div>` : ""}
          ${snapshot.bic_swift ? `<div style="margin:0 0 5px;font-size:14px;color:#374151;"><strong>BIC/SWIFT:</strong> ${escapeHtml(String(snapshot.bic_swift))}</div>` : ""}
          ${paymentReason ? paymentCopyFieldHtml("Causale bonifico", paymentReason, "Copia causale") : ""}
          ${snapshot.payment_instructions ? `<div style="margin:10px 0 0;font-size:13px;color:#6B7280;">${escapeHtml(String(snapshot.payment_instructions))}</div>` : ""}
        </td></tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;border:1px solid #D9E2EC;border-radius:10px;margin:0 0 22px;">
        <tr><td style="padding:16px 18px;font-size:14px;color:#374151;">Le modalità operative per il versamento della caparra saranno comunicate dallo staff IschiaStars.</td></tr>
      </table>`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#F4F6F9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr><td style="background:#C9A84C;height:4px;border-radius:10px 10px 0 0;font-size:0;">&nbsp;</td></tr>
    <tr><td class="header-padding" style="background:#1B3A5C;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            ${logoUrl ? `<img src="${safeEmailUrl(logoUrl)}" alt="IschiaStars" width="150" style="display:block;max-width:150px;height:auto;margin:0 0 8px;">` : `<div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;">IschiaStars</div>`}
            <div style="font-size:13px;color:#C9A84C;letter-spacing:0.5px;">Conferma definitiva</div>
          </td>
          <td align="right">
            <span style="border:1.5px solid #C9A84C;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:bold;color:#C9A84C;letter-spacing:0.8px;">DA SALDARE</span>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td class="email-body" style="background:#FFFFFF;padding:28px 32px;color:#374151;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 18px;font-size:15px;">Ciao <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 12px;font-size:15px;">la struttura ha confermato la disponibilità per la proposta selezionata.</p>
      <p style="margin:0 0 12px;font-size:15px;">Per bloccare definitivamente il soggiorno è necessario versare la caparra.</p>
      ${balanceInstruction ? `<p style="margin:0 0 22px;font-size:15px;">${balanceInstruction}</p>` : ""}

      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D9E2EC;border-radius:10px;overflow:hidden;margin:0 0 22px;">
        <tr><td colspan="2" style="background:#1B3A5C;padding:12px 16px;">
          <div style="font-size:16px;font-weight:bold;color:#FFFFFF;">${escapeHtml(hotelName)}</div>
          <div style="font-size:12px;color:#C9A84C;margin-top:3px;">${escapeHtml(treatmentLabel)}</div>
        </td></tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">Arrivo</td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:bold;color:#1B3A5C;">${arrivalLabel}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">Partenza</td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:bold;color:#1B3A5C;">${departureLabel}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">Prezzo totale</td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:bold;color:#1B3A5C;">${totalPriceLabel}</td>
        </tr>
        ${depositLabel ? `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">Caparra</td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:bold;color:#15803D;">${depositLabel}</td>
        </tr>` : ""}
        ${balanceLabel ? `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">Saldo restante</td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:bold;color:#1B3A5C;">${balanceLabel}</td>
        </tr>` : ""}
        ${balanceLabel ? `<tr>
          <td style="padding:12px 16px;font-size:13px;color:#6B7280;">Scadenza saldo</td>
          <td align="right" style="padding:12px 16px;font-size:13px;font-weight:bold;color:#374151;">${balanceDueLabel ? `Entro il ${balanceDueLabel}` : balanceSchedule.title}</td>
        </tr>` : ""}
      </table>

      ${additionalServicesHtml}
      ${coordinatesHtml}
      ${confirmation?.selectedCancellationPolicy ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF5E6;border:1px solid #C9A84C;border-radius:10px;margin:0 0 22px;"><tr><td style="padding:16px 18px;font-size:13px;color:#5F4B16;"><strong>Policy cancellazione</strong><br>${escapeHtml(confirmation.selectedCancellationPolicy)}</td></tr></table>` : ""}
      ${details.notes ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;border-radius:10px;margin:0 0 22px;"><tr><td style="padding:16px 18px;font-size:13px;color:#374151;"><strong>Note</strong><br>${escapeHtml(details.notes)}</td></tr></table>` : ""}

      <p style="margin:0;font-size:13px;color:#6B7280;">Per qualsiasi dubbio puoi rispondere a questa email o scriverci su WhatsApp.</p>
    </td></tr>
    <tr><td class="footer-padding" style="background:#1B3A5C;padding:16px 32px;border-radius:0 0 10px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><div style="font-size:12px;font-weight:bold;color:#FFFFFF;">IschiaStars</div><div style="font-size:11px;color:#94A3B8;margin-top:2px;">Il tuo specialista per Ischia</div></td>
        <td align="right"><span style="font-size:10px;color:#C9A84C;">Preventivo ${quote.code}</span></td>
      </tr></table>
    </td></tr>
  </table>
  </div>
</body></html>`;
}

export async function sendFinalConfirmationEmailToClient(quote: Quote, details: FinalConfirmationEmailDetails): Promise<boolean> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped final confirmation code=${quote.code} reason=${missingEnvReason}`);
    return false;
  }

  const email = quote.confirmation?.email?.trim() || quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const confirmation = quote.confirmation;
  const additionalServices = getConfirmationAdditionalServices(confirmation?.metadata);
  const snapshot = details.paymentSettingsSnapshot ?? confirmation?.paymentSettingsSnapshot ?? {};
  const paymentReason = typeof snapshot.payment_reason === "string" ? snapshot.payment_reason : "";
  const firstName = quote.customerFirstName || "Cliente";
  const arrivalLabel = formatDate(quote.arrivalDate);
  const departureLabel = formatDate(quote.departureDate);
  const hotelName = confirmation?.selectedHotelName ?? quote.proposedHotel.name;
  const balanceLabel = confirmation?.selectedBalanceAmount != null ? formatPrice(confirmation.selectedBalanceAmount) : "";
  const balanceSchedule = getEffectiveBalancePaymentSchedule({
    balanceMethod: confirmation?.selectedBalanceMethod,
    arrivalDate: quote.arrivalDate,
    hotelName
  });
  const balanceDueLabel = balanceSchedule.dueDate ? formatDate(balanceSchedule.dueDate) : "";
  const balanceText = balanceLabel
    ? balanceDueLabel
      ? `Saldo restante: ${balanceLabel} entro il ${balanceDueLabel}`
      : balanceSchedule.type === "in_structure"
        ? `Saldo restante: ${balanceLabel} da versare in struttura`
        : `Saldo restante: ${balanceLabel}`
    : "";

  const coordinatesHtml = snapshot.configured === true
    ? `<p><strong>Coordinate caparra</strong><br>
        ${snapshot.bank_account_holder ? `Intestatario: ${snapshot.bank_account_holder}<br>` : ""}
        ${snapshot.bank_name ? `Banca: ${snapshot.bank_name}<br>` : ""}
        ${snapshot.iban ? paymentCopyFieldHtml("IBAN", String(snapshot.iban), "Copia IBAN") : ""}
        ${snapshot.iban ? `La quinta lettera è la I di Imola.<br>` : ""}
        ${snapshot.bic_swift ? `BIC/SWIFT: ${snapshot.bic_swift}<br>` : ""}
        ${paymentReason ? paymentCopyFieldHtml("Causale bonifico", paymentReason, "Copia causale") : ""}
        ${snapshot.payment_instructions ? `${snapshot.payment_instructions}<br>` : ""}
      </p>`
    : `<p>Le modalità operative per il versamento della caparra saranno comunicate dallo staff IschiaStars.</p>`;

  const html = `<!DOCTYPE html><html lang="it"><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a4a2a;padding:22px 32px;color:#fff;font-weight:bold;font-size:18px;">Conferma definitiva IschiaStars</td></tr>
        <tr><td style="padding:28px 32px;color:#333;font-size:15px;line-height:1.7;">
          <p>Ciao ${firstName},</p>
          <p>la struttura ha confermato la disponibilità per la proposta selezionata. Per bloccare definitivamente il soggiorno è necessario versare la caparra.</p>
          ${balanceText ? `<p><strong>${balanceText}</strong></p>` : ""}
          <p><strong>Hotel:</strong> ${hotelName}<br>
          <strong>Trattamento:</strong> ${confirmation?.selectedTreatmentLabel ?? quote.treatment}<br>
          <strong>Prezzo totale:</strong> ${confirmation?.selectedPrice != null ? formatPrice(confirmation.selectedPrice) : formatPrice(quote.totalPrice)}<br>
          ${confirmation?.selectedDepositAmount != null ? `<strong>Caparra:</strong> ${formatPrice(confirmation.selectedDepositAmount)}<br>` : ""}
          ${balanceText ? `<strong>${balanceText}</strong>` : ""}</p>
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
    "La struttura ha confermato la disponibilità.",
    "Caparra da versare per bloccare la prenotazione.",
    ...(balanceText ? [balanceText] : []),
    `Hotel: ${hotelName}`,
    `Arrivo: ${arrivalLabel}`,
    `Partenza: ${departureLabel}`,
    `Trattamento: ${confirmation?.selectedTreatmentLabel ?? quote.treatment}`,
    `Prezzo totale: ${confirmation?.selectedPrice != null ? formatPrice(confirmation.selectedPrice) : formatPrice(quote.totalPrice)}`,
    ...(confirmation?.selectedDepositAmount != null ? [`Caparra: ${formatPrice(confirmation.selectedDepositAmount)}`] : []),
    ...(additionalServices.length ? ["", "Servizi aggiuntivi:", ...additionalServices.map((service) => `- ${formatConfirmationAdditionalService(service)}`)] : []),
    ...(snapshot.configured === true ? [
      snapshot.bank_account_holder ? `Intestatario: ${snapshot.bank_account_holder}` : "",
      snapshot.bank_name ? `Banca: ${snapshot.bank_name}` : "",
      snapshot.iban ? `IBAN: ${snapshot.iban}` : "",
      snapshot.iban ? "La quinta lettera è la I di Imola." : "",
      snapshot.bic_swift ? `BIC/SWIFT: ${snapshot.bic_swift}` : "",
      paymentReason ? `Causale: ${paymentReason}` : "",
      snapshot.payment_instructions ? `Istruzioni: ${snapshot.payment_instructions}` : ""
    ].filter(Boolean) : ["Le modalità operative per il versamento della caparra saranno comunicate dallo staff IschiaStars."]),
    ...(confirmation?.selectedCancellationPolicy ? [`Policy cancellazione: ${confirmation.selectedCancellationPolicy}`] : []),
    ...(details.notes ? [`Note: ${details.notes}`] : []),
    "",
    "IschiaStars"
  ].join("\n");

  const finalSubject = `Conferma definitiva soggiorno - ${quote.code}`;
  const finalResult = await sendBrevoEmailWithResult({
    to: [{ email, name: `${quote.customerFirstName} ${quote.customerLastName}`.trim() }],
    subject: finalSubject,
    html: buildFinalConfirmationEmailHtml(quote, details),
    text,
    replyTo: { email: process.env.BREVO_FROM_EMAIL || "info@ischiastars.it", name: process.env.BREVO_FROM_NAME || "IschiaStars" }
  });
  await logEmailAttempt({ quoteId: quote.id, confirmationId: quote.confirmation?.id, emailType: "final_confirmation_to_client", recipientEmail: email, subject: finalSubject, brevoMessageId: finalResult.messageId, ok: finalResult.ok, errorMessage: finalResult.error });
  return finalResult.ok;
}

export async function sendVoucherEmailToClient(quote: Quote, pdfBase64: string): Promise<boolean> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped voucher email code=${quote.code} reason=${missingEnvReason}`);
    return false;
  }

  const email = quote.confirmation?.email?.trim() || quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn(`[brevo] skipped voucher email code=${quote.code} reason=missing_client_email`);
    return false;
  }

  const firstName = quote.confirmation?.firstName ?? quote.customerFirstName ?? "Cliente";
  const fullName = `${quote.confirmation?.firstName ?? quote.customerFirstName} ${quote.confirmation?.lastName ?? quote.customerLastName}`.trim();

  const hotelName = quote.confirmation?.selectedHotelName ?? quote.proposedHotel?.name ?? "";
  const treatmentLabel = quote.confirmation?.selectedTreatmentLabel ?? "";
  const arrivalLabel = quote.arrivalDate ? formatDate(quote.arrivalDate) : "";
  const departureLabel = quote.departureDate ? formatDate(quote.departureDate) : "";
  const depositLabel = quote.confirmation?.selectedDepositAmount != null
    ? formatPrice(quote.confirmation.selectedDepositAmount)
    : "";
  const balanceLabel = quote.confirmation?.selectedBalanceAmount != null
    ? formatPrice(quote.confirmation.selectedBalanceAmount)
    : "";
  const balanceSchedule = getEffectiveBalancePaymentSchedule({
    balanceMethod: quote.confirmation?.selectedBalanceMethod,
    arrivalDate: quote.arrivalDate,
    hotelName
  });
  const balanceDueLabel = balanceSchedule.dueDate ? formatDate(balanceSchedule.dueDate) : "";

  const bookingRowStyle = `padding:10px 14px;border-bottom:1px solid #e5e7eb;`;
  const bookingLabelStyle = `font-size:12px;color:#6b7280;display:block;margin-bottom:2px;`;
  const bookingValueStyle = `font-size:14px;font-weight:bold;color:#1B3A5C;`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">

    <!-- Gold top accent -->
    <tr><td style="background:#C9A84C;height:4px;border-radius:4px 4px 0 0;font-size:0;">&nbsp;</td></tr>

    <!-- Navy header -->
    <tr><td class="header-padding" style="background:#1B3A5C;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div class="section-title" style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;">IschiaStars</div>
            <div style="font-size:13px;color:#C9A84C;margin-top:4px;letter-spacing:0.5px;">Voucher di Prenotazione</div>
          </td>
          <td align="right">
            <span style="border:1.5px solid #C9A84C;border-radius:4px;padding:5px 12px;font-size:11px;font-weight:bold;color:#C9A84C;letter-spacing:1px;">CONFERMATO</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Body -->
    <tr><td class="email-body" style="background:#ffffff;padding:28px 32px;">
      <p style="margin:0 0 18px;font-size:15px;color:#374151;">Ciao <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.6;">
        abbiamo ricevuto la tua caparra. La prenotazione è confermata e il tuo soggiorno a Ischia è assicurato. In allegato trovi il voucher ufficiale da conservare.
      </p>

      <!-- Booking recap -->
      ${hotelName ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9e2ec;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <tr><td style="background:#1B3A5C;padding:10px 14px;">
          <span style="font-size:15px;font-weight:bold;color:#ffffff;">${escapeHtml(hotelName)}</span>
          ${treatmentLabel ? `<span style="font-size:12px;color:#94a3b8;margin-left:10px;">${escapeHtml(treatmentLabel)}</span>` : ""}
        </td></tr>
        ${arrivalLabel || departureLabel ? `
        <tr>
          ${arrivalLabel ? `<td style="${bookingRowStyle}" width="50%">
            <span style="${bookingLabelStyle}">Check-in</span>
            <span style="${bookingValueStyle}">${arrivalLabel}</span>
          </td>` : ""}
          ${departureLabel ? `<td style="${bookingRowStyle}" width="50%">
            <span style="${bookingLabelStyle}">Check-out</span>
            <span style="${bookingValueStyle}">${departureLabel}</span>
          </td>` : ""}
        </tr>` : ""}
        ${depositLabel ? `
        <tr>
          <td style="${bookingRowStyle}">
            <span style="${bookingLabelStyle}">Caparra versata</span>
            <span style="font-size:14px;font-weight:bold;color:#15803d;">${depositLabel} ✓</span>
          </td>
          ${balanceLabel ? `<td style="${bookingRowStyle}">
            <span style="${bookingLabelStyle}">${balanceSchedule.title}${balanceDueLabel ? ` entro il ${balanceDueLabel}` : ""}</span>
            <span style="${bookingValueStyle}">${balanceLabel}</span>
          </td>` : "<td></td>"}
        </tr>` : ""}
        <tr><td colspan="2" style="padding:8px 14px;background:#f6f8fb;">
          <span style="font-size:11px;color:#6b7280;">Rif. prenotazione: <strong style="color:#1B3A5C;">${quote.code}-V</strong></span>
        </td></tr>
      </table>` : ""}

      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.6;">
        Per qualsiasi dubbio o informazione siamo sempre disponibili su WhatsApp.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td class="footer-padding" style="background:#1B3A5C;padding:16px 32px;border-radius:0 0 8px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:12px;font-weight:bold;color:#ffffff;">IschiaStars</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Il tuo specialista per Ischia</div>
          </td>
          <td align="right">
            <span style="font-size:10px;color:#C9A84C;">N. ${quote.code}-V</span>
          </td>
        </tr>
      </table>
    </td></tr>

  </table>
  </div>
</body></html>`;

  const text = [
    `Ciao ${firstName},`,
    "",
    "abbiamo ricevuto la tua caparra. La prenotazione è confermata e il tuo soggiorno a Ischia è assicurato. In allegato trovi il voucher ufficiale da conservare.",
    "",
    ...(hotelName ? [`Hotel: ${hotelName}`] : []),
    ...(treatmentLabel ? [`Trattamento: ${treatmentLabel}`] : []),
    ...(arrivalLabel ? [`Check-in: ${arrivalLabel}`] : []),
    ...(departureLabel ? [`Check-out: ${departureLabel}`] : []),
    ...(depositLabel ? [`Caparra versata: ${depositLabel}`] : []),
    ...(balanceLabel ? [`${balanceSchedule.title}${balanceDueLabel ? ` entro il ${balanceDueLabel}` : ""}: ${balanceLabel}`] : []),
    "",
    `Riferimento prenotazione: ${quote.code}-V`,
    "",
    "Per qualsiasi informazione siamo sempre disponibili su WhatsApp.",
    "",
    "IschiaStars"
  ].join("\n");

  const voucherSubject = `Il tuo voucher IschiaStars — ${quote.code}`;
  const voucherResult = await sendBrevoEmailWithResult({
    to: [{ email, name: fullName }],
    subject: voucherSubject,
    html,
    text,
    replyTo: { email: process.env.BREVO_FROM_EMAIL || "info@ischiastars.it", name: process.env.BREVO_FROM_NAME || "IschiaStars" },
    attachment: [{ name: `voucher-${quote.code}.pdf`, content: pdfBase64 }]
  });
  await logEmailAttempt({ quoteId: quote.id, confirmationId: quote.confirmation?.id, emailType: "voucher_to_client", recipientEmail: email, subject: voucherSubject, brevoMessageId: voucherResult.messageId, ok: voucherResult.ok, errorMessage: voucherResult.error });
  return voucherResult.ok;
}

export async function sendSupplierConfirmationEmail(params: {
  to: string;
  quote: Quote;
  confirmation: QuoteConfirmation;
  netPrice: number;
  notes?: string;
}): Promise<boolean> {
  const { to, quote, confirmation, netPrice, notes } = params;

  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped supplier confirmation email code=${quote.code} reason=${missingEnvReason}`);
    return false;
  }

  const fullName = `${confirmation.firstName ?? quote.customerFirstName} ${confirmation.lastName ?? quote.customerLastName}`.trim();
  const phone = confirmation.phone ?? quote.customerPhone;
  const email = confirmation.email ?? quote.customerEmail;
  const whatsapp = ischiastarsWhatsappNumber();

  const childrenRows = (quote.children ?? [])
    .map((child, index) => {
      const ageLabel = child.age != null ? `${child.age} anni` : child.birthDate ? `nato il ${formatDate(child.birthDate)}` : "età non indicata";
      return `<tr><td style="padding:6px 0;color:#555;">Bambino ${index + 1}</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${ageLabel}</td></tr>`;
    })
    .join("");
  const childrenText = (quote.children ?? [])
    .map((child, index) => {
      const ageLabel = child.age != null ? `${child.age} anni` : child.birthDate ? `nato il ${formatDate(child.birthDate)}` : "età non indicata";
      return `Bambino ${index + 1}: ${ageLabel}`;
    })
    .join("; ");

  const netPriceFormatted = formatPrice(netPrice);

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td class="header-padding" style="background:#1B3A5C;padding:22px 32px;color:#fff;">
          <div class="section-title" style="font-weight:bold;font-size:22px;">IschiaStars — Conferma Prenotazione</div>
          <div style="margin-top:6px;font-size:13px;color:#dbe5f0;">Gentile fornitore, confermiamo la seguente prenotazione:</div>
        </td></tr>
        <tr><td class="email-body" style="padding:24px 32px;color:#1F2937;font-size:14px;line-height:1.6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
            <tr><td colspan="2" style="font-weight:bold;color:#1B3A5C;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Dati cliente</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Nome</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${escapeHtml(fullName)}</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Telefono</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${escapeHtml(phone || "-")}</td></tr>
            ${email ? `<tr><td style="padding:6px 0;color:#555;">Email</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${escapeHtml(email)}</td></tr>` : ""}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
            <tr><td colspan="2" style="font-weight:bold;color:#1B3A5C;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Dati soggiorno</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Hotel/Struttura</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${escapeHtml(confirmation.selectedHotelName ?? "-")}</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Trattamento</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${escapeHtml(confirmation.selectedTreatmentLabel ?? "-")}</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${formatDate(quote.arrivalDate)}</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${formatDate(quote.departureDate)}</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Adulti</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${quote.adults}</td></tr>
            <tr><td style="padding:6px 0;color:#555;">Camere</td><td style="padding:6px 0;font-weight:bold;text-align:right;">${quote.rooms}</td></tr>
            ${childrenRows}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF5E6;border:1px solid #C9A84C;border-radius:8px;margin-bottom:18px;">
            <tr><td style="padding:14px 18px;font-weight:bold;color:#7a5a12;">Prezzo netto concordato: ${netPriceFormatted}</td></tr>
          </table>
          ${notes?.trim() ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;border-radius:8px;margin-bottom:18px;">
            <tr><td style="padding:14px 18px;color:#374151;"><strong>Note:</strong> ${escapeHtml(notes.trim())}</td></tr>
          </table>` : ""}
          <p style="color:#555;">Per conferma rispondere a questa email.</p>
        </td></tr>
        <tr><td class="footer-padding" style="padding:18px 32px;border-top:1px solid #e5e7eb;color:#6B7280;font-size:12px;">
          IschiaStars — WhatsApp +${whatsapp}
        </td></tr>
  </table>
  </div>
</body></html>`;

  const text = [
    "IschiaStars — Conferma Prenotazione",
    "Gentile fornitore, confermiamo la seguente prenotazione:",
    "",
    "Dati cliente",
    `Nome: ${fullName}`,
    `Telefono: ${phone || "-"}`,
    ...(email ? [`Email: ${email}`] : []),
    "",
    "Dati soggiorno",
    `Hotel/Struttura: ${confirmation.selectedHotelName ?? "-"}`,
    `Trattamento: ${confirmation.selectedTreatmentLabel ?? "-"}`,
    `Check-in: ${formatDate(quote.arrivalDate)}`,
    `Check-out: ${formatDate(quote.departureDate)}`,
    `Adulti: ${quote.adults}`,
    `Camere: ${quote.rooms}`,
    ...(childrenText ? [childrenText] : []),
    "",
    `Prezzo netto concordato: ${netPriceFormatted}`,
    ...(notes?.trim() ? ["", `Note: ${notes.trim()}`] : []),
    "",
    "Per conferma rispondere a questa email.",
    "",
    `IschiaStars — WhatsApp +${whatsapp}`
  ].join("\n");

  const supplierSubject = `Conferma prenotazione — ${confirmation.selectedHotelName ?? quote.proposedHotel.name} — ${quote.code}`;
  const supplierResult = await sendBrevoEmailWithResult({
    to: [{ email: to }],
    subject: supplierSubject,
    html,
    text,
    replyTo: { email: process.env.BREVO_FROM_EMAIL || "info@ischiastars.it", name: process.env.BREVO_FROM_NAME || "IschiaStars" }
  });
  await logEmailAttempt({ quoteId: quote.id, confirmationId: confirmation.id, emailType: "supplier_confirmation", recipientEmail: to, subject: supplierSubject, brevoMessageId: supplierResult.messageId, ok: supplierResult.ok, errorMessage: supplierResult.error });
  return supplierResult.ok;
}

export async function sendAvailabilityUnavailableEmailToClient(quote: Quote, details: AvailabilityUnavailableEmailDetails): Promise<boolean> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped unavailable email code=${quote.code} reason=${missingEnvReason}`);
    return false;
  }

  const email = quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const messageHtml = details.message.split("\n").map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : "").join("");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td class="header-padding" style="background:#1a3a5c;padding:22px 32px;color:#fff;">
          <p class="section-title" style="margin:0;font-weight:bold;font-size:22px;">Aggiornamento disponibilità struttura</p>
        </td></tr>
        <tr><td class="email-body" style="padding:28px 32px;color:#1F2937;font-size:15px;line-height:1.6;">
          ${messageHtml}
          <p><strong>Preventivo:</strong> ${quote.code}<br>
          <strong>Hotel selezionato:</strong> ${escapeHtml(quote.confirmation?.selectedHotelName ?? quote.proposedHotel.name)}<br>
          <strong>Date:</strong> ${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}<br>
          <strong>Trattamento:</strong> ${escapeHtml(quote.confirmation?.selectedTreatmentLabel ?? quote.treatment)}</p>
          ${details.reason ? `<p><strong>Nota:</strong> ${escapeHtml(details.reason)}</p>` : ""}
        </td></tr>
  </table>
  </div>
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

  const unavailSubject = `Aggiornamento disponibilità struttura - ${quote.code}`;
  const unavailResult = await sendBrevoEmailWithResult({
    to: [{ email, name: `${quote.customerFirstName} ${quote.customerLastName}`.trim() }],
    subject: unavailSubject,
    html,
    text,
    replyTo: { email: process.env.BREVO_FROM_EMAIL || "info@ischiastars.it", name: process.env.BREVO_FROM_NAME || "IschiaStars" }
  });
  await logEmailAttempt({ quoteId: quote.id, confirmationId: quote.confirmation?.id, emailType: "unavailability_to_client", recipientEmail: email, subject: unavailSubject, brevoMessageId: unavailResult.messageId, ok: unavailResult.ok, errorMessage: unavailResult.error });
  return unavailResult.ok;
}

function formatDateTimeForEmail(value: string) {
  try {
    return new Date(value).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
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

export type SendFollowUpEmailResult = { sent: boolean; skipReason?: string; error?: string };

export async function sendFollowUpEmailToClient(quote: Quote): Promise<SendFollowUpEmailResult> {
  const missingEnvReason = brevoMissingEnvReason();
  if (missingEnvReason) {
    console.info(`[brevo] skipped follow-up email code=${quote.code} reason=${missingEnvReason}`);
    return { sent: false, skipReason: missingEnvReason };
  }

  const email = quote.customerEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn(`[brevo] skipped follow-up email code=${quote.code} reason=missing_client_email`);
    return { sent: false, skipReason: "missing_client_email" };
  }

  const quoteUrl = absoluteShortPublicQuoteUrl(quote);
  const firstName = quote.customerFirstName?.trim() || "";
  const greeting = firstName ? `Salve ${firstName},` : "Salve,";
  const clientName = `${quote.customerFirstName} ${quote.customerLastName}`.trim();
  const replyEmail = process.env.BREVO_FROM_EMAIL || "info@ischiastars.it";
  const replyName = process.env.BREVO_FROM_NAME || "IschiaStars";

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailSharedStyles()}
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div class="email-wrapper" style="padding:24px 16px;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr>
      <td class="header-padding" style="background:#1a3a5c;padding:28px 32px;text-align:center;">
        <p class="section-title" style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;">IschiaStars</p>
        <p style="margin:6px 0 0;color:#a8c4e0;font-size:13px;">Promemoria proposta soggiorno a Ischia</p>
      </td>
    </tr>
    <tr>
      <td class="email-body" style="padding:28px 32px 24px;">
        <p style="margin:0 0 18px;font-size:15px;color:#1F2937;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.6;">
          solo un rapido promemoria: ha avuto modo di valutare la proposta per il suo soggiorno a Ischia?
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${safeEmailUrl(quoteUrl)}" class="cta-button"
             style="background:#1a3a5c;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;letter-spacing:0.5px;">
            Rivedi il preventivo
          </a>
        </div>
        <p style="text-align:center;margin:0 0 24px;font-size:12px;word-break:break-all;">
          <a href="${safeEmailUrl(quoteUrl)}" style="color:#1a3a5c;">${escapeHtml(quoteUrl)}</a>
        </p>
        <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
          Se Le interessa Le consiglio di confermare al più presto, perché la disponibilità è in continuo aggiornamento e potrebbe presto terminare.
        </p>
        <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Resto a disposizione.</p>
      </td>
    </tr>
    <tr>
      <td class="footer-padding" style="background:#f0f6ff;padding:20px 32px;text-align:center;border-top:1px solid #e0e8f0;">
        <p style="margin:0;font-size:13px;color:#666;">Diego · IschiaStars</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999;">info@ischiastars.it</p>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>`;

  const text = [
    greeting,
    "",
    "solo un rapido promemoria: ha avuto modo di valutare la proposta per il suo soggiorno a Ischia?",
    "",
    "Può rivedere il preventivo da qui:",
    quoteUrl,
    "",
    "Se Le interessa Le consiglio di confermare al più presto, perché la disponibilità è in continuo aggiornamento e potrebbe presto terminare.",
    "",
    "Resto a disposizione.",
    "",
    "Diego",
    "IschiaStars"
  ].join("\n");

  const subject = `Promemoria proposta soggiorno a Ischia - ${quote.code}`;

  console.info(`[brevo] sending follow-up email code=${quote.code} to=${maskEmail(email)}`);
  const sendResult = await sendBrevoEmailWithResult({
    to: [{ email, name: clientName }],
    subject,
    html,
    text,
    replyTo: { email: replyEmail, name: replyName }
  });

  if (sendResult.ok) {
    console.info(`[brevo] sent follow-up email code=${quote.code}`);
    await logEmailAttempt({ quoteId: quote.id, emailType: "follow_up_to_client", recipientEmail: email, subject, brevoMessageId: sendResult.messageId, ok: true });
    return { sent: true };
  }

  console.warn(`[brevo] failed follow-up email code=${quote.code} status=${sendResult.status ?? "fetch_error"} error=${sendResult.error ?? "-"}`);
  await logEmailAttempt({ quoteId: quote.id, emailType: "follow_up_to_client", recipientEmail: email, subject, ok: false, errorMessage: sendResult.error });
  return { sent: false, error: sendResult.error ?? `brevo_error_${sendResult.status ?? "fetch"}` };
}
