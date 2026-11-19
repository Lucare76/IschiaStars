import type { VoucherDocumentData } from "@/lib/pdf/VoucherDocument";
import type { Quote } from "@/lib/types";
import {
  englishDate,
  englishMoney,
  requireEnglishText,
} from "@/lib/i18n/quote-language";
import {
  selectedConfirmationOption,
  selectedTreatmentLabel,
} from "@/lib/confirmation-stay-details";
import { getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";
export function localizedVoucherData(
  quote: Quote,
  data: VoucherDocumentData,
): VoucherDocumentData {
  if (quote.language !== "en") return data;
  const t = (value?: string | null) => requireEnglishText(quote, value);
  const option = selectedConfirmationOption(quote);
  const included = option?.includedServices
    ? t(option.includedServices).split("\n")
    : quote.servicesIncluded.map(t);
  const treatment = selectedTreatmentLabel(quote);
  if (treatment)
    included.push(
      ...treatment.split(" + ").map((part) => `${t(part)} included`),
    );
  included.push(
    ...getConfirmationAdditionalServices(quote.confirmation?.metadata).map(
      (service) =>
        `${t(service.label)}${service.cost != null ? ` (${englishMoney(service.cost)})` : ""}`,
    ),
  );
  const rooms = quote.confirmation?.metadata?.selected_rooms;
  const roomLabels = Array.isArray(rooms)
    ? rooms
        .map((room) =>
          typeof room?.roomTypeLabel === "string" ? t(room.roomTypeLabel) : "",
        )
        .filter(Boolean)
    : [];
  const time = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Rome",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : undefined;
  return {
    ...data,
    language: "en",
    roomTypeLabel: roomLabels.length
      ? Array.from(new Set(roomLabels)).join(" + ")
      : t(data.roomTypeLabel),
    treatmentLabel: treatment
      ?.split(" + ")
      .map((part) => t(part))
      .join(" + "),
    arrivalDate: englishDate(quote.arrivalDate),
    departureDate: englishDate(quote.departureDate),
    guestsLabel: `${quote.adults} adults${quote.children.length ? `, ${quote.children.length} children` : ""}`,
    includedServices: Array.from(new Set(included.filter(Boolean))),
    depositPaidAtLabel:
      time(quote.confirmation?.depositPaidAt) ?? data.depositPaidAtLabel,
    balancePaidAtLabel: time(quote.confirmation?.balancePaidAt),
    balanceTitleLabel: "Remaining balance",
    balanceMethodLabel: t(quote.confirmation?.selectedBalanceMethod),
    cancellationPolicy: t(data.cancellationPolicy),
    voucherNotes: t(data.voucherNotes),
  };
}
