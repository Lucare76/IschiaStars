export function adminApiHeaders(headers: HeadersInit = {}) {
  const baseHeaders = new Headers(headers);
  if (!baseHeaders.has("Content-Type")) baseHeaders.set("Content-Type", "application/json");
  return baseHeaders;
}
