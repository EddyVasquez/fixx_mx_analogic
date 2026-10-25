import { config } from "../config/fixx.config";
import { round2 } from "./time";

/** Professional may adjust FIXX's suggested price within +/- pct (demo value). */
export function priceBounds(suggested: number, pct: number = config.professionalPriceLimitPct) {
  return { min: round2(suggested * (1 - pct / 100)), max: round2(suggested * (1 + pct / 100)) };
}
export const isWithinLimits = (suggested: number, proposed: number, pct?: number): boolean => {
  const b = priceBounds(suggested, pct);
  return proposed >= b.min && proposed <= b.max;
};
export const clampPrice = (suggested: number, proposed: number, pct?: number): number => {
  const b = priceBounds(suggested, pct);
  return Math.min(b.max, Math.max(b.min, proposed));
};
/** Surcharge is shown to the customer before they confirm. */
export const emergencyTotal = (base: number, cfg: typeof config = config): number => round2(base + cfg.emergencySurchargeMXN);
