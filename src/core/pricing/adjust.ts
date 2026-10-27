import { bookingFee, proLaborPayout, revenue, roundMoney } from "../../config/revenue";
import { config } from "../config/fixx.config";
import { priceBounds, type QuoteLine } from "../rules";
import { customerLines } from "./quote";

export interface AdjustableQuote {
  total: number;
  lines: QuoteLine[];
  labor: number;
  materials: number;
  wageFloor: number;
  bookingFee: number;
  payout: number;
}

/** The professional can move the suggested labor payout by the configured percent, and never below the wage floor. */
export function payoutLimits(suggestedPayout: number, wageFloor: number, pct: number = config.professionalPriceLimitPct) {
  const band = priceBounds(suggestedPayout, pct);
  return { min: roundMoney(Math.max(band.min, wageFloor)), max: band.max };
}

/**
 * The professional adjusts labor payout, not a share of the customer total.
 * Materials stay at the catalog materials price.
 * The customer total is materials + labor + the booking fee. The booking fee is the shortfall
 * when the wage floor used is higher than labor after FIXX's share, and zero otherwise.
 */
export function adjustQuote(
  base: AdjustableQuote, proposedPayout: number, pct: number = config.professionalPriceLimitPct
): AdjustableQuote & { factor: number } {
  const proposed = roundMoney(proposedPayout);
  const limits = payoutLimits(base.payout, base.wageFloor, pct);
  if (proposed < limits.min - 0.001 || proposed > limits.max + 0.001) throw new RangeError("payout is outside the allowed range");
  if (Math.abs(proposed - base.payout) < 0.005) {
    return { ...base, lines: base.lines.map((l) => ({ ...l })), payout: base.payout, factor: 1 };
  }

  const labor = roundMoney(proposed / (1 - revenue.proCommission));
  const payout = proLaborPayout(labor, base.wageFloor);
  const fee = bookingFee(labor, base.wageFloor);
  const lines = customerLines({ materials: base.materials, labor, bookingFee: fee });
  const total = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  return {
    ...base,
    labor,
    lines,
    total,
    payout,
    bookingFee: fee,
    factor: base.payout === 0 ? 1 : proposed / base.payout
  };
}

export { priceBounds };
