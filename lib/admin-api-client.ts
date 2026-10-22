function asciiSafeJsonBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return body;

  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed).replace(/[\u007f-\uffff]/g, (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
  } catch {
    return body;
  }
}

export function adminApiHeaders(headers: HeadersInit = {}) {
  const baseHeaders = new Headers(headers);
  if (!baseHeaders.has("Content-Type")) baseHeaders.set("Content-Type", "application/json");
  return baseHeaders;
}

export async function adminApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = new Headers(init.headers);
  if (isFormData) headers.delete("Content-Type");
  else if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const requestInit: RequestInit = {
    ...init,
    body: isFormData ? init.body : asciiSafeJsonBody(init.body),
    cache: init.cache ?? "no-store",
    credentials: init.credentials ?? "include",
    headers
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
