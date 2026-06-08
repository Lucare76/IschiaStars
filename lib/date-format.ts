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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatStayRangeRome(arrival: string | Date, departure: string | Date) {
  const start = parseDate(arrival);
  const end = parseDate(departure);
  if (!start || !end) return "-";

  const dayFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: ROME_TIME_ZONE, day: "2-digit" });
  const monthYearFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: ROME_TIME_ZONE, month: "long", year: "numeric" });

  if (monthYearFormatter.format(start) === monthYearFormatter.format(end)) {
    return `Dal ${dayFormatter.format(start)} al ${dayFormatter.format(end)} ${capitalize(monthYearFormatter.format(end))}`;
  }

  return `Dal ${formatDateRome(start)} al ${formatDateRome(end)}`;
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
