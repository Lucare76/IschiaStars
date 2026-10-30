import nodemailer from "nodemailer";

export function supplierSmtpEnabled() {
  return process.env.SUPPLIER_EMAIL_PROVIDER === "smtp";
}

function transporter() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim() || process.env.MAIL_INBOX_USER?.trim();
  const pass = process.env.SMTP_PASSWORD || process.env.MAIL_INBOX_PASSWORD;
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !pass || ![465, 587].includes(port)) throw new Error("SMTP_NOT_CONFIGURED");
  return { user, transport: nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: true,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false
  }) };
}

export async function verifySupplierSmtp() {
  const { transport } = transporter();
  try { await transport.verify(); } finally { transport.close(); }
}

export async function sendSupplierSmtp(params: {
  to: string; subject: string; html: string; text: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const { user, transport } = transporter();
    try {
      // Keep the real hotel recipient explicit; CC acceptance is not success for To.
      const result = await transport.sendMail({
        from: { name: process.env.BREVO_FROM_NAME || "IschiaStars", address: user },
        to: params.to, cc: user, replyTo: user,
        subject: params.subject, html: params.html, text: params.text
      });
      const accepted = result.accepted.map((address) => String(address).trim().toLowerCase());
      if (!accepted.includes(params.to.trim().toLowerCase())) return { ok: false, error: "SMTP_RECIPIENT_REJECTED" };
      // This is SMTP acceptance, not proof of final delivery or opening.
      return { ok: true, messageId: `smtp:${result.messageId}` };
    } finally { transport.close(); }
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "SMTP_SEND_FAILED";
    return { ok: false, error: code };
  }
}
