type FeatureRule = {
  pattern: RegExp;
  label: string;
  /** Label of the less-specific rule to suppress when this matches */
  blocksLabel?: string;
};

// Ordered: specific rules first so they can suppress generic siblings
const FEATURE_RULES: FeatureRule[] = [
  { pattern: /navetta\s+gratuita/i, label: "Navetta gratuita", blocksLabel: "Navetta disponibile" },
  { pattern: /spiaggia\s+inclusa/i, label: "Spiaggia inclusa", blocksLabel: "Spiaggia" },
  { pattern: /spiaggia\s+convenzionata/i, label: "Spiaggia convenzionata", blocksLabel: "Spiaggia" },
  { pattern: /piscina\s+termale/i, label: "Piscina termale", blocksLabel: "Piscina" },
  { pattern: /parcheggio\s+gratuito/i, label: "Parcheggio gratuito", blocksLabel: "Parcheggio" },
  { pattern: /colazione\s+inclusa/i, label: "Colazione inclusa" },
  { pattern: /centro\s+benessere/i, label: "Centro benessere" },
  { pattern: /vista\s+mare/i, label: "Vista mare" },
  { pattern: /animali\s+ammessi/i, label: "Animali ammessi" },
  { pattern: /bambini\s+gratis/i, label: "Bambini gratis" },
  { pattern: /navetta/i, label: "Navetta disponibile" },
  { pattern: /spiaggia/i, label: "Spiaggia" },
  { pattern: /piscina/i, label: "Piscina" },
  { pattern: /\bterme\b/i, label: "Terme" },
  { pattern: /\bspa\b/i, label: "Spa" },
  { pattern: /parcheggio/i, label: "Parcheggio" },
];

const MAX_FEATURES = 5;

export function extractHighlightedFeatures(input: {
  hotelName?: string;
  services?: string;
  includedServices?: string;
  notes?: string;
  description?: string;
}): string[] {
  const text = [
    input.hotelName,
    input.services,
    input.includedServices,
    input.notes,
    input.description,
  ]
    .filter(Boolean)
    .join(" ");

  if (!text.trim()) return [];

  const found: string[] = [];
  const blocked = new Set<string>();

  for (const rule of FEATURE_RULES) {
    if (found.length >= MAX_FEATURES) break;
    if (blocked.has(rule.label)) continue;
    if (rule.pattern.test(text)) {
      found.push(rule.label);
      if (rule.blocksLabel) blocked.add(rule.blocksLabel);
    }
  }

  return found;
}
