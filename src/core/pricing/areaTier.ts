/** Catalog home-size bands, for example "≤60 m²" and "61–100 m²". */

export interface AreaTierBounds {
  min: number;
  max: number;
}

const UNIT = String.raw`(?:m²|m2)`;

/** Reads a catalog tier label. Returns null when the label is not an area band. */
export function parseAreaTier(label: string): AreaTierBounds | null {
  const trimmed = label.trim();
  const upper = trimmed.match(new RegExp(`^(?:≤|<=)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}$`, "u"));
  if (upper?.[1]) return { min: 0, max: Number(upper[1]) };
  const range = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*[–-]\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}$`, "u"));
  if (range?.[1] && range[2]) return { min: Number(range[1]), max: Number(range[2]) };
  return null;
}

export function isAreaTierList(tiers: readonly string[]): boolean {
  return tiers.length > 0 && tiers.every((tier) => parseAreaTier(tier) != null);
}

/**
 * The band that contains this area.
 * A value that falls in a gap between whole-number bands (100.49 is above 100 and below 101)
 * uses the next band, the first one whose maximum is at least the area.
 */
export function matchingAreaTier(areaM2: number, tiers: readonly string[]): string | null {
  const parsed = tiers.flatMap((label) => {
    const bounds = parseAreaTier(label);
    return bounds ? [{ label, ...bounds }] : [];
  }).sort((a, b) => a.max - b.max || a.min - b.min);
  const exact = parsed.find((row) => areaM2 >= row.min && areaM2 <= row.max);
  if (exact) return exact.label;
  return parsed.find((row) => areaM2 <= row.max)?.label ?? null;
}
