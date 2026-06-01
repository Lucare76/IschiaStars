const ROME_TIME_ZONE = "Europe/Rome";

function parseDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateRome(value: string | Date) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatDateTimeRome(value: string | Date) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
