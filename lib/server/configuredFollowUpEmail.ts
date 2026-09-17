import type { Quote } from "@/lib/types";
import { renderFollowUpTemplate } from "@/lib/follow-up-settings";
import { getBusinessContactSettings } from "@/lib/repositories/businessContactSettings";
import { logEmailAttempt } from "@/lib/repositories/emailLogs";
import { getFollowUpSettings } from "@/lib/repositories/followUpSettings";
import { sendBrevoEmail } from "@/lib/server/brevo";
import { absoluteShortPublicQuoteUrl, formatCurrency, formatDate } from "@/lib/utils";

export type SendConfiguredFollowUpEmailResult = { sent: boolean; skipReason?: string; error?: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function multilineHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

export async function sendConfiguredFollowUpEmailToClient(quote: Quote): Promise<SendConfiguredFollowUpEmailResult> {
  const recipient = quote.customerEmail?.trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { sent: false, skipReason: "missing_client_email" };
  }

  const [settingsResult, contactsResult] = await Promise.all([
    getFollowUpSettings(),
    getBusinessContactSettings()
  ]);
  const emailSettings = settingsResult.data.email;
  const contacts = contactsResult.data;

  if (!emailSettings.enabled) {
    return { sent: false, skipReason: "disabled_by_admin" };
  }

  const values = {
    nome: quote.customerFirstName?.trim() || "Cliente",
    codice: quote.code,
    hotel: quote.proposedHotel?.name || quote.requestedHotel || "",
    arrivo: formatDate(quote.arrivalDate),
    partenza: formatDate(quote.departureDate),
    prezzo: formatCurrency(quote.totalPrice),
    link_preventivo: absoluteShortPublicQuoteUrl(quote)
  };

  const subject = renderFollowUpTemplate(emailSettings.subject, values);
  const body = renderFollowUpTemplate(emailSettings.body, values);
  const signature = renderFollowUpTemplate(emailSettings.signature, values);
  const quoteUrl = values.link_preventivo;
  const clientName = `${quote.customerFirstName ?? ""} ${quote.customerLastName ?? ""}`.trim();

  const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <div style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.08);">
      <tr><td style="background:#1a3a5c;padding:24px 28px;color:#fff;"><div style="font-size:20px;font-weight:800;">IschiaStars</div><div style="margin-top:4px;font-size:13px;color:#dbeafe;">Promemoria preventivo</div></td></tr>
      <tr><td style="padding:28px;font-size:15px;line-height:1.7;">
        <div>${multilineHtml(body)}</div>
        <div style="margin:24px 0;text-align:center;"><a href="${escapeHtml(quoteUrl)}" style="display:inline-block;background:#0b67a3;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px;">Apri il preventivo</a></div>
        <div style="padding-top:18px;border-top:1px solid #e5e7eb;">${multilineHtml(signature)}</div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 28px;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">${escapeHtml(contacts.phone)} · ${escapeHtml(contacts.email)}</td></tr>
    </table>
  </div>
</body>
</html>`;

  const text = [body, "", quoteUrl, "", signature, "", `${contacts.phone} · ${contacts.email}`].join("\n");
  const sent = await sendBrevoEmail({
    to: [{ email: recipient, name: clientName || undefined }],
    subject,
    html,
    text,
    replyTo: { email: contacts.email, name: "IschiaStars" }
  });

  await logEmailAttempt({
    quoteId: quote.id,
    emailType: "follow_up_to_client",
    recipientEmail: recipient,
    subject,
    ok: sent,
    errorMessage: sent ? undefined : "configured_follow_up_send_failed"
  });

  return sent
    ? { sent: true }
    : { sent: false, error: "Invio email non riuscito" };
}
