import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { laborCommission, payoutFloor, proShare } from "../src/config/revenue";
import { customerLines } from "../src/core/pricing/quote";
import { quoteTask, type Catalog, type UrgencyLevel } from "../src/core/pricing/instantQuote";

const cat = JSON.parse(readFileSync(join(process.cwd(), "src/seed/pricing/catalog.json"), "utf8")) as Catalog;
const csvPath = join(process.cwd(), "tests/fixtures/v30_split_changes.csv");

describe("catalog v30 labor split", () => {
  it("pays MTL-001 Budget Standard 754.38 to the pro and keeps 133.13", () => {
    const quote = quoteTask(cat, { taskId: "FIXX-MTL-001", tier: "Budget", urgency: "STANDARD" });
    expect(laborCommission(quote.labor)).toBe(133.13);
    expect(proShare(quote.labor)).toBe(754.38);
    expect(proShare(quote.labor) + laborCommission(quote.labor)).toBe(quote.labor);
    expect(quote.payout).toBe(754.38);
    expect(quote.bookingFee).toBe(0);
    expect(quote.total).toBe(2242.42);
    expect(customerLines(quote).map((line) => line.id)).not.toContain("commission");
  });

  it("matches every changed v30 split row", () => {
    const rows = readFileSync(csvPath, "utf8").trim().split(/\r?\n/).slice(1).map((line) => line.split(","));
    expect(rows).toHaveLength(223);
    const customerMoves = rows.filter((row) => Number(row[17]) !== 0);
    expect(customerMoves).toHaveLength(36);
    expect([...new Set(customerMoves.map((row) => row[0]))].sort()).toEqual([
      "FIXX-CAR-001", "FIXX-ELC-001", "FIXX-GRD-001", "FIXX-GRD-002", "FIXX-GRD-003"
    ]);
    expect(customerMoves.every((row) => Number(row[17]) === 0.01)).toBe(true);
    expect(rows.filter((row) => Number(row[17]) === 0)).toHaveLength(187);
    expect(rows.every((row) => Number(row[11]) === 0.01)).toBe(true);

    const wrong = rows.flatMap((row) => {
      const [taskId, tier, urgency, , , effFloor, , payoutAfter, , , shareAfter, , , feeAfter, , , totalAfter] = row;
      const quote = quoteTask(cat, { taskId: taskId!, tier: tier!, urgency: urgency as UrgencyLevel });
      const commission = laborCommission(quote.labor);
      const share = proShare(quote.labor);
      const floor = payoutFloor(quote.floor, quote.multiplier);
      const cents = (amount: number) => Math.round(amount * 100);
      const label = `${taskId}|${tier}|${urgency}`;
      const problems = [
        commission === Number(shareAfter) ? "" : `commission ${commission}!=${shareAfter}`,
        cents(share) + cents(commission) === cents(quote.labor) ? "" : `share+commission ${share}+${commission}!=${quote.labor}`,
        quote.payout === Number(payoutAfter) ? "" : `payout ${quote.payout}!=${payoutAfter}`,
        quote.bookingFee === Number(feeAfter) ? "" : `fee ${quote.bookingFee}!=${feeAfter}`,
        quote.total === Number(totalAfter) ? "" : `total ${quote.total}!=${totalAfter}`,
        floor === Number(effFloor) ? "" : `floor ${floor}!=${effFloor}`,
        quote.payout === Math.max(share, floor) ? "" : `payout ${quote.payout}!=max(${share},${floor})`
      ].filter(Boolean);
      return problems.length ? [`${label} ${problems.join("; ")}`] : [];
    });
    expect(wrong).toEqual([]);
  });
});
