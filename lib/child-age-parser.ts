/** Converts email ages to completed years, retaining the original text in the importer. */
export function parseChildAges(value: string): number[] {
  const matches = value.matchAll(/(\d+)(?:\s*(mesi|mese|months?|anni|anno|years?)\b)?/gi);
  return Array.from(matches, (match) => {
    const age = Number(match[1]);
    return /^(mesi|mese|months?)$/i.test(match[2] ?? "") ? Math.floor(age / 12) : age;
  });
}
