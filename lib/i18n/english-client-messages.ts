import type { Quote, QuoteHotelOption } from "@/lib/types";
import {
  englishDate,
  englishMoney,
  missingEnglishTranslations,
  requireEnglishText,
} from "@/lib/i18n/quote-language";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { getQuoteCostBreakdown } from "@/lib/confirmation-additional-services";
import { getEffectiveBalancePaymentSchedule } from "@/lib/hotel-policies";

export type EnglishClientMessageKind =
  | "quote"
  | "confirmation"
  | "voucher"
  | "balance"
  | "follow_up"
  | "interested"
  | "unavailable";
export function assertEnglishReady(quote: Quote) {
  if (missingEnglishTranslations(quote).length)
    throw new Error(
      "Completa i testi mancanti nella sezione Versione inglese prima di inviare.",
    );
}
export function englishProposalLines(
  quote: Quote,
  options: QuoteHotelOption[] = getEffectiveHotelOptions(quote),
) {
  return options.flatMap((option) => [
    option.hotelName,
    ...(option.roomTypeLabel
      ? [requireEnglishText(quote, option.roomTypeLabel)]
      : []),
    ...option.treatments.map(
      (treatment) =>
        `${requireEnglishText(quote, treatment.label)}: ${englishMoney(treatment.price)} total ${quote.rooms > 1 ? "per room" : "for your stay"}`,
    ),
    ...(option.notes ? [requireEnglishText(quote, option.notes)] : []),
    "",
  ]);
}
export function englishQuoteWhatsapp(
  quote: Quote,
  options: QuoteHotelOption[],
  quoteUrl: string,
) {
  assertEnglishReady(quote);
  return [
    `Hello ${quote.customerFirstName}!`,
    "Your personalised Ischia holiday offers are ready 🌊",
    "",
    `📅 ${englishDate(quote.arrivalDate)} → ${englishDate(quote.departureDate)}`,
    `👥 ${quote.adults} adults${quote.children.length ? `, ${quote.children.length} children` : ""} · ${quote.rooms} ${quote.rooms === 1 ? "room" : "rooms"}`,
    "",
    "Open your offer for full details ⬇️",
    quoteUrl,
    "",
    ...englishProposalLines(quote, options),
    ...(quote.customerNotes
      ? [requireEnglishText(quote, quote.customerNotes), ""]
      : []),
    `OFFER VALID UNTIL: ${englishDate(quote.offerExpiresAt)}`,
    "Subject to availability. Please contact us with any questions.",
    "",
    "📞 +39 081 90 54 81",
    "💬 WhatsApp +39 371 75 90 017",
    "https://ischiastars.it/en/",
    "",
    "Diego – Ischia Stars ☀️",
  ].join("\n");
}
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function buildEnglishClientEmail(
  quote: Quote,
  kind: EnglishClientMessageKind,
  url: string,
  details: {
    notes?: string;
    depositDueAt?: string;
    paymentSettingsSnapshot?: Record<string, unknown>;
    message?: string;
  } = {},
) {
  assertEnglishReady(quote);
  const c = quote.confirmation;
  const titles: Record<EnglishClientMessageKind, string> = {
    quote: "Your personalised Ischia holiday offer",
    confirmation: "Your Ischia booking: availability confirmed",
    voucher: "Your Ischia Stars booking voucher",
    balance: "Deposit received: remaining balance",
    follow_up: "Your Ischia holiday: can we help?",
    interested: "Your selected Ischia hotel",
    unavailable: "An update on your Ischia holiday request",
  };
  const lines = [`Hello ${c?.firstName ?? quote.customerFirstName},`, ""];
  if (kind === "quote")
    lines.push(
      "We have prepared the following proposals for your stay:",
      "",
      ...englishProposalLines(quote),
    );
  else if (kind === "unavailable")
    lines.push(requireEnglishText(quote, details.message));
  else if (kind === "follow_up" || kind === "interested")
    lines.push(
      "Have you had a chance to review your personalised holiday offer? We are happy to answer your questions or help you choose the right hotel.",
    );
  else if (kind === "voucher")
    lines.push(
      "Your booking voucher is attached to this email. Please present it at check-in. It includes the services registered for your booking.",
    );
  else if (kind === "balance")
    lines.push(
      "Thank you, we have received your deposit. Your remaining balance is shown below.",
    );
  else
    lines.push(
      "We have checked availability with the hotel. Please review the booking and payment details below.",
    );
  lines.push(
    "",
    `Booking reference: ${quote.code}`,
    `Dates: ${englishDate(quote.arrivalDate)} – ${englishDate(quote.departureDate)}`,
    `Guests: ${quote.adults} adults${quote.children.length ? `, ${quote.children.length} children` : ""} · ${quote.rooms} ${quote.rooms === 1 ? "room" : "rooms"}`,
  );
  if (
    c &&
    !["quote", "follow_up", "interested", "unavailable"].includes(kind)
  ) {
    if (c.selectedHotelName) lines.push(`Hotel: ${c.selectedHotelName}`);
    const breakdown = getQuoteCostBreakdown(quote);
    if (breakdown) {
      lines.push(
        `${breakdown.hasUnpricedServices ? "Accommodation and services without a separate price" : "Hotel accommodation"}: ${englishMoney(breakdown.accommodation)}`,
        ...breakdown.services.map(
          (s) =>
            `${requireEnglishText(quote, s.label)}: ${s.cost != null ? englishMoney(s.cost) : "Price not specified"}`,
        ),
        `Grand total: ${englishMoney(breakdown.total)}`,
      );
    } else
      lines.push(`Total: ${englishMoney(c.selectedPrice ?? quote.totalPrice)}`);
    if (c.selectedDepositAmount != null)
      lines.push(
        `${c.depositPaidAt ? "Deposit received" : "Deposit"}: ${englishMoney(c.selectedDepositAmount)}`,
      );
    if (c.selectedBalanceAmount != null)
      lines.push(
        `${c.balancePaidAt ? "Balance received" : "Remaining balance"}: ${englishMoney(c.selectedBalanceAmount)}`,
      );
    if (details.depositDueAt)
      lines.push(`Payment due: ${englishDate(details.depositDueAt)}`);
    const schedule = getEffectiveBalancePaymentSchedule({
      balanceMethod: c.selectedBalanceMethod,
      arrivalDate: quote.arrivalDate,
      hotelName: c.selectedHotelName,
    });
    if (schedule.dueDate)
      lines.push(`Balance due by: ${englishDate(schedule.dueDate)}`);
    if (c.selectedBalanceMethod)
      lines.push(requireEnglishText(quote, c.selectedBalanceMethod));
    const snapshot =
      details.paymentSettingsSnapshot ?? c.paymentSettingsSnapshot;
    if (kind === "confirmation" && snapshot?.configured === true) {
      lines.push("", "Bank transfer details");
      if (snapshot.payment_request_type === "full_balance")
        lines.push(
          `Full balance to pay: ${englishMoney(Number(snapshot.payment_request_amount ?? c.selectedPrice ?? quote.totalPrice))}`,
        );
      if (snapshot.payment_due_at)
        lines.push(
          `Payment deadline: ${englishDate(String(snapshot.payment_due_at))}`,
        );
      for (const [key, label] of [
        ["bank_account_holder", "Account holder"],
        ["bank_name", "Bank"],
        ["iban", "IBAN"],
        ["bic_swift", "BIC / SWIFT"],
        ["payment_reason", "Payment reference"],
      ])
        if (snapshot[key]) lines.push(`${label}: ${String(snapshot[key])}`);
      if (snapshot.payment_instructions)
        lines.push(
          requireEnglishText(quote, String(snapshot.payment_instructions)),
        );
    }
    if (c.selectedCancellationPolicy)
      lines.push(
        "",
        "Cancellation policy:",
        requireEnglishText(quote, c.selectedCancellationPolicy),
      );
  }
  if (details.notes) lines.push("", requireEnglishText(quote, details.notes));
  if (quote.customerNotes && kind === "quote")
    lines.push("", requireEnglishText(quote, quote.customerNotes));
  lines.push("", "View your personalised offer:", url);
  if (kind === "quote")
    lines.push(
      `Offer valid until: ${englishDate(quote.offerExpiresAt)}`,
      "Your selection is a booking request. We will check availability before requesting your deposit.",
    );
  lines.push(
    "",
    "Phone: +39 081 90 54 81",
    "WhatsApp: +39 371 75 90 017",
    "Email: info@ischiastars.it",
    "https://ischiastars.it/en/",
    "",
    "Diego – Ischia Stars",
  );
  const subject = `${titles[kind]} — ${quote.code}`;
  const text = lines.join("\n");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f2f8fc;font-family:Arial,sans-serif;color:#1B3A5C"><div style="max-width:640px;margin:24px auto;background:white;border-radius:16px;overflow:hidden"><div style="padding:24px;background:#1B3A5C;color:white;border-top:4px solid #F9B935"><strong style="font-size:22px">Ischia Stars</strong><p>Your Ischia holiday specialists</p></div><div style="padding:24px"><h1 style="font-size:23px">${escape(titles[kind])}</h1><p style="line-height:1.8;white-space:pre-line">${escape(text)}</p><a href="${escape(url)}" style="display:inline-block;padding:12px 24px;background:#F9B935;color:#1B3A5C;border-radius:24px;text-decoration:none;font-weight:bold">View your offer</a><p><a href="https://wa.me/393717590017">Chat with us on WhatsApp</a></p></div></div></body></html>`;
  return {
    to: {
      email: c?.email?.trim() || quote.customerEmail.trim(),
      name: `${c?.firstName ?? quote.customerFirstName} ${c?.lastName ?? quote.customerLastName}`.trim(),
    },
    subject,
    html,
    text,
  };
}
