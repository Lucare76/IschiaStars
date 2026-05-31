export function adminApiHeaders(headers: HeadersInit = {}) {
  const baseHeaders = new Headers(headers);
  if (!baseHeaders.has("Content-Type")) baseHeaders.set("Content-Type", "application/json");
  return baseHeaders;
}

export async function adminApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const requestInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include",
    headers: adminApiHeaders(init.headers)
  };

  const response = await fetch(input, requestInit);
  if (response.status !== 401) return response;

  const refresh = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  }).catch(() => null);

  if (!refresh?.ok) return response;
  return fetch(input, requestInit);
}
