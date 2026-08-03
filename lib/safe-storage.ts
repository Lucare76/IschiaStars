function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    return getLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    getLocalStorage()?.setItem(key, value);
  } catch {
    // Storage non disponibile o bloccato: ignorato volontariamente, non deve mai rompere il render.
  }
}

export function safeSessionStorageGet(key: string): string | null {
  try {
    return getSessionStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSessionStorageSet(key: string, value: string): void {
  try {
    getSessionStorage()?.setItem(key, value);
  } catch {
    // Storage non disponibile o bloccato: ignorato volontariamente, non deve mai rompere il render.
  }
}

export function safeRandomId(prefix?: string): string {
  const suffix = generateRandomSuffix();
  return prefix ? `${prefix}_${suffix}` : suffix;
}

function generateRandomSuffix(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // crypto.randomUUID non disponibile o bloccato: si prova il fallback successivo.
  }

  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // crypto.getRandomValues non disponibile o bloccato: si usa il fallback finale.
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
