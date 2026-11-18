import { roundUpToCentavo } from "../../config/revenue";
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
/** Urgent labor is priced by the catalog urgency rate inside the quote. There is no flat add-on. */
export const emergencyTotal = (base: number, _cfg: typeof config = config): number => round2(base);

/**
 * Round up to the next centavo. An exact centavo stays put.
 * 1234.561 becomes 1234.57. 887.50 stays 887.50.
 */
export const ceilToCentavo = roundUpToCentavo;

/**
 * Customer amount for a payout the professional typed.
 * Rounded up to the next centavo, never to the nearest ten.
 */
export function customerAmountFromPayout(payout: number, payoutRatio: number): number {
  if (!(payoutRatio > 0 && payoutRatio <= 1)) throw new RangeError("payoutRatio must be between 0 and 1");
  return ceilToCentavo(payout / payoutRatio);
}
