/** Suggest a new occupancy while retaining the room category and amenities. */
export function roomLabelForOccupancy(label: string, guests: number): string {
  const occupancy = ["", "singola", "matrimoniale", "tripla", "quadrupla"][guests];
  if (!occupancy) return label;
  if (!label.trim()) return `Camera ${occupancy} standard`;
  return label.replace(/\b(singola|doppia|matrimoniale|tripla|quadrupla)\b/i, occupancy);
}
