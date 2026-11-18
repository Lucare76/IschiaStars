export function quoteLanguageFromPageUrl(pageUrl: string): "it" | "en" {
  try {
    const url = new URL(pageUrl);
    const isSite = url.origin === "https://ischiastars.it" || url.origin === "https://www.ischiastars.it";
    return isSite && /^\/en(?:\/|$)/.test(url.pathname) ? "en" : "it";
  } catch {
    return "it";
  }
}
