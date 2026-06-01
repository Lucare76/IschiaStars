const ROME_TIME_ZONE = "Europe/Rome";

export function formatDateRome(value: string | Date) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTimeRome(value: string | Date) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
