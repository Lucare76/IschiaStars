export function adminApiHeaders(headers: HeadersInit = {}) {
  const baseHeaders = new Headers(headers);
  if (!baseHeaders.has("Content-Type")) baseHeaders.set("Content-Type", "application/json");
  return baseHeaders;
}

export async function adminApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const requestInit: RequestInit = {
    ...init,
    cache: init.cache ?? "no-store",
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

export async function readAdminApiJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

export function adminApiErrorMessage(
  response: Response,
  payload: { error?: string } | null | undefined,
  fallback = "Operazione non riuscita."
) {
  if (response.status === 401) return "Sessione scaduta, effettua di nuovo il login.";
  if (response.status === 403) return "Non hai i permessi per completare questa operazione.";
  return payload?.error ?? fallback;
}
