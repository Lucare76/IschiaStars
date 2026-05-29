import "server-only";

const SITE_CONTACT_PATTERNS = [
  /\b081[\s.]?90[\s.]?54[\s.]?81\b/,
  /\b371[\s.]?75[\s.]?90[\s.]?017\b/,
];

const SITE_NAV_RE = /^(?:Home|Gli Hotel|Escursioni|Linee Bus|Treni|Preventivo|Contatti?|Mappa del sito|Ischia)$/i;

const NOISE_PATTERNS: RegExp[] = [
  /\{[^}]{3,}\}/,
  /\bfunction\s*\(/,
  /\bvar\s+\w+\s*=/,
  /\bconst\s+\w+\s*=/,
  /\blet\s+\w+\s*=/,
  /\bdocument\./,
  /\bwindow\./,
  /\bdisplay\s*:/,
  /\bposition\s*:/,
  /\bbackground\s*:/,
  /\bmargin\s*:/,
  /\bpadding\s*:/,
  /@media\s/,
  /grid-template/,
  /\.hotel-gallery\b/,
  /\.hotel-stars\b/,
  /\blightbox\b/i,
  /\bInstagram\b/i,
  /\bWhatsapp\b/i,
  /\bEnvelope\b/i,
  /\bFacebook\b/i,
  /\bTwitter\b/i,
  /\bYoutube\b/i,
  /^[×❮❯✕✖✗▶◀►◄]+$/,
];

export function isUsefulHotelTextLine(line: string): boolean {
  if (!line) return false;
  const l = line.trim();
  if (l.length < 8) return false;
  if (SITE_NAV_RE.test(l)) return false;
  if (SITE_CONTACT_PATTERNS.some((p) => p.test(l))) return false;
  return !NOISE_PATTERNS.some((p) => p.test(l));
}

export function cleanImportedHotelText(text: string, maxLength = 3000): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => isUsefulHotelTextLine(l))
    .filter((l, i, arr) => arr.indexOf(l) === i)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
