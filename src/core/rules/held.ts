import { round2 } from "./time";

export interface QuoteLine { id: string; amount: number }
export interface HeldResult { held: number; heldPayout: number; released: number; wholeJob: boolean }

/**
 * Amount held while an issue report is open.
 * Selected items: their cost. "wholeJob" or an unitemized quote: the full job amount (deposit + balance).
 * `payoutRatio` (0..1) is the professional's net share of any amount, so professionals see only their net held share.
 * Additional-work lines can be passed like any other line (decision G6).
 */
export function computeHeld(i: {
  lines: readonly QuoteLine[]; selected: readonly string[] | "wholeJob"; jobTotal: number; payoutRatio: number;
}): HeldResult {
  if (i.payoutRatio < 0 || i.payoutRatio > 1) throw new RangeError("payoutRatio must be between 0 and 1");
  const whole = i.selected === "wholeJob" || i.lines.length === 0;
  let held: number;
  if (whole) held = i.jobTotal;
  else {
    const ids = i.selected as readonly string[];
    held = ids.reduce((sum, id) => {
      const line = i.lines.find((l) => l.id === id);
      if (!line) throw new Error(`Unknown quote line: ${id}`);
      return sum + line.amount;
    }, 0);
    held = Math.min(held, i.jobTotal);
  }
  held = round2(held);
  return { held, heldPayout: round2(held * i.payoutRatio), released: round2(i.jobTotal - held), wholeJob: whole };
}
