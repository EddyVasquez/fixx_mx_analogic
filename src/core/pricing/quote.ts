import { config } from "../config/fixx.config";
import type { QuoteLine } from "../rules";

const round10 = (n: number) => Math.round(n / 10) * 10;

/** FIXX estimate range for a category. The surcharge is shown separately, before the customer confirms. */
export function estimateRange(categoryId: string, emergency: boolean, cfg: typeof config = config) {
  const r = cfg.estimateRangesMXN[categoryId];
  if (!r) throw new Error(`No estimate range configured for ${categoryId}`);
  return { low: r[0], high: r[1], surcharge: emergency ? cfg.emergencySurchargeMXN : 0 };
}

/** Demo quote: the midpoint of the range, split into generic lines that always add up to the total. */
export function buildQuote(categoryId: string, emergency: boolean, cfg: typeof config = config): { total: number; lines: QuoteLine[] } {
  const { low, high, surcharge } = estimateRange(categoryId, emergency, cfg);
  const base = round10((low + high) / 2);
  const prep = round10(base * 0.15), mat = round10(base * 0.35);
  const lines: QuoteLine[] = [{ id: "prep", amount: prep }, { id: "mat", amount: mat }, { id: "work", amount: base - prep - mat }];
  if (surcharge > 0) lines.push({ id: "urgent", amount: surcharge });
  return { total: base + surcharge, lines };
}
