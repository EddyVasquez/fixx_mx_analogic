import { config } from "../config/fixx.config";
import { isWithinLimits, priceBounds, round2, type QuoteLine } from "../rules";

const round10 = (n: number) => Math.round(n / 10) * 10;

/** FIXX's suggested payout for a quote total. Professionals see payouts only; customers see totals. */
export const suggestedPayout = (total: number, payoutRatio: number): number => round2(total * payoutRatio);

/**
 * The professional adjusts the suggested payout within +/- the configured limit. The customer's quote is scaled by the same factor.
 * The urgent surcharge line is not scaled. Throws if the proposed payout is outside the limits.
 */
export function adjustQuote(
  base: { total: number; lines: QuoteLine[] }, payoutRatio: number, proposedPayout: number, pct: number = config.professionalPriceLimitPct
): { total: number; lines: QuoteLine[]; payout: number; factor: number } {
  const suggested = suggestedPayout(base.total, payoutRatio);
  if (!isWithinLimits(suggested, proposedPayout, pct)) throw new RangeError("payout is outside the allowed range");
  const factor = proposedPayout / suggested;
  if (factor === 1) return { total: base.total, lines: base.lines.map((l) => ({ ...l })), payout: suggested, factor: 1 };

  const urgent = base.lines.filter((l) => l.id === "urgent");
  const scalable = base.lines.filter((l) => l.id !== "urgent");
  const baseScalable = scalable.reduce((s, l) => s + l.amount, 0);
  const target = round10(baseScalable * factor);
  let used = 0;
  const lines: QuoteLine[] = scalable.map((l, i) => {
    const amount = i === scalable.length - 1 ? target - used : round10(l.amount * factor);
    used += amount;
    return { id: l.id, amount };
  });
  const out = [...lines, ...urgent.map((l) => ({ ...l }))];
  const total = out.reduce((s, l) => s + l.amount, 0);
  return { total, lines: out, payout: suggestedPayout(total, payoutRatio), factor };
}
export { priceBounds };
