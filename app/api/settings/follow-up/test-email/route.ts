import { NextRequest, NextResponse } from "next/server";
import { renderFollowUpTemplate } from "@/lib/follow-up-settings";
import { getBusinessContactSettings } from "@/lib/repositories/businessContactSettings";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { sendBrevoEmail } from "@/lib/server/brevo";

const testValues = {
  nome: "Maria",
  codice: "IS-TEST-2500",
  hotel: "Hotel Terme Example",
  arrivo: "21 settembre 2026",
  partenza: "28 settembre 2026",
  prezzo: "€ 799",
  link_preventivo: "https://preventivi.ischiastars.it"
};

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

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const payload = await request.json().catch(() => null) as {
    to?: unknown;
    subject?: unknown;
    body?: unknown;
    signature?: unknown;
  } | null;

  const to = typeof payload?.to === "string" ? payload.to.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Inserisci un indirizzo email valido" }, { status: 400 });
  }

  const subjectTemplate = typeof payload?.subject === "string" ? payload.subject.slice(0, 200) : "";
  const bodyTemplate = typeof payload?.body === "string" ? payload.body.slice(0, 6000) : "";
  const signatureTemplate = typeof payload?.signature === "string" ? payload.signature.slice(0, 2000) : "";

  if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
    return NextResponse.json({ ok: false, error: "Oggetto e corpo email sono obbligatori" }, { status: 400 });
  }

  const contacts = (await getBusinessContactSettings()).data;
  const subject = `[TEST] ${renderFollowUpTemplate(subjectTemplate, testValues)}`;
  const renderedBody = renderFollowUpTemplate(bodyTemplate, testValues);
  const body = renderedBody
    .split("\n")
    .filter((line) => !line.includes(testValues.link_preventivo))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const signature = renderFollowUpTemplate(signatureTemplate, testValues);

  const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <div style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.08);">
      <tr><td style="background:#1a3a5c;padding:24px 28px;color:#fff;"><div style="font-size:20px;font-weight:800;">IschiaStars</div><div style="margin-top:4px;font-size:13px;color:#dbeafe;">TEST follow-up preventivo</div></td></tr>
      <tr><td style="padding:28px;font-size:15px;line-height:1.7;">
        <div>${multilineHtml(body)}</div>
        <div style="margin:24px 0;text-align:center;"><a href="${testValues.link_preventivo}" style="display:inline-block;background:#0b67a3;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px;">Apri il preventivo</a></div>
        <div style="padding-top:18px;border-top:1px solid #e5e7eb;">${multilineHtml(signature)}</div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 28px;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">${escapeHtml(contacts.phone)} · ${escapeHtml(contacts.email)}</td></tr>
    </table>
  </div>
</body>
</html>`;

  const text = [body, "", testValues.link_preventivo, "", signature, "", `${contacts.phone} · ${contacts.email}`].join("\n");
  const sent = await sendBrevoEmail({
    to: [{ email: to, name: "Test IschiaStars" }],
    subject,
    html,
    text,
    replyTo: { email: contacts.email, name: "IschiaStars" }
  });

  return sent
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "Invio test non riuscito" }, { status: 502 });
}
