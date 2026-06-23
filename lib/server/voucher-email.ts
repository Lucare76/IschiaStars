import { formatConfirmationAdditionalService, getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";
import { getBalancePaymentSchedule } from "@/lib/hotel-policies";
import { generateVoucherPdf } from "@/lib/pdf/generateVoucher";
import { sendVoucherEmailToClient } from "@/lib/server/brevo";
import type { Quote } from "@/lib/types";
import { formatClientName, formatCurrency, formatDate, formatDateTime, ischiastarsWhatsappNumber } from "@/lib/utils";

export type VoucherEmailResult = {
  sent: boolean;
  error: string | null;
};

export async function generateAndSendVoucherEmail(
  quote: Quote,
  options: {
    depositPaidAt?: string;
    balancePaidAt?: string;
    isBalancePaid?: boolean;
  } = {}
): Promise<VoucherEmailResult> {
  const confirmation = quote.confirmation;
  if (!confirmation) return { sent: false, error: "Conferma non trovata per il voucher." };

  try {
    const depositPaidAt = options.depositPaidAt ?? confirmation.depositPaidAt ?? new Date().toISOString();
    const balancePaidAt = options.balancePaidAt ?? confirmation.balancePaidAt ?? undefined;
    const isBalancePaid = options.isBalancePaid ?? Boolean(balancePaidAt);

    const guestsParts: string[] = [];
    if (quote.adults) guestsParts.push(`${quote.adults} ${quote.adults === 1 ? "adulto" : "adulti"}`);
    if (quote.children?.length) guestsParts.push(`${quote.children.length} ${quote.children.length === 1 ? "bambino" : "bambini"}`);

    const depositAmount = confirmation.selectedDepositAmount ?? quote.deposit;
    const balanceAmount = confirmation.selectedBalanceAmount;
    const selectedOption = quote.hotelOptions.find((option) => option.id === confirmation.selectedHotelOptionId);
    const includedServices = selectedOption?.includedServices
      ? selectedOption.includedServices.split("\n").map((service) => service.trim()).filter(Boolean)
      : (quote.servicesIncluded ?? []);
    includedServices.push(...getConfirmationAdditionalServices(confirmation.metadata).map(formatConfirmationAdditionalService));

    let nightsCount: number | undefined;
    if (quote.arrivalDate && quote.departureDate) {
      const nights = Math.round(
        (new Date(quote.departureDate).getTime() - new Date(quote.arrivalDate).getTime()) / 86400000
      );
      if (nights > 0) nightsCount = nights;
    }

    const balanceSchedule = getBalancePaymentSchedule(confirmation.selectedBalanceMethod, quote.arrivalDate);
    const pdfBuffer = await generateVoucherPdf({
      quoteCode: quote.code,
      clientFullName: formatClientName(confirmation.firstName ?? quote.customerFirstName, confirmation.lastName ?? quote.customerLastName),
      clientEmail: confirmation.email ?? quote.customerEmail,
      clientPhone: confirmation.phone ?? quote.customerPhone,
      hotelName: confirmation.selectedHotelName,
      roomTypeLabel: selectedOption?.roomTypeLabel ?? undefined,
      treatmentLabel: confirmation.selectedTreatmentLabel,
      arrivalDate: quote.arrivalDate ? formatDate(quote.arrivalDate) : undefined,
      departureDate: quote.departureDate ? formatDate(quote.departureDate) : undefined,
      nightsCount,
      guestsLabel: guestsParts.length ? guestsParts.join(", ") : undefined,
      includedServices,
      depositAmountLabel: typeof depositAmount === "number" ? formatCurrency(depositAmount) : "—",
      depositPaidAtLabel: formatDateTime(depositPaidAt),
      balanceAmountLabel: typeof balanceAmount === "number" ? formatCurrency(balanceAmount) : undefined,
      balanceTitleLabel: balanceSchedule.title,
      balanceDueDateLabel: balanceSchedule.dueDate ? formatDate(balanceSchedule.dueDate) : undefined,
      balanceMethodLabel: confirmation.selectedBalanceMethod,
      isBalancePaid,
      balancePaidAtLabel: isBalancePaid && balancePaidAt ? formatDateTime(balancePaidAt) : undefined,
      cancellationPolicy: confirmation.selectedCancellationPolicy ?? quote.cancellationPolicy,
      voucherNotes: confirmation.voucherNotes,
      whatsappNumber: ischiastarsWhatsappNumber()
    });

    const sent = await sendVoucherEmailToClient(quote, pdfBuffer.toString("base64"));
    if (!sent) return { sent: false, error: "Invio email voucher non riuscito." };
    return { sent: true, error: null };
  } catch (error) {
    return { sent: false, error: serializeVoucherEmailError(error) };
  }
}

function serializeVoucherEmailError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Invio email voucher non riuscito.";
}
