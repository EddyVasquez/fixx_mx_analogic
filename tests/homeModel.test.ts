import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatMXN } from "../src/core/clock/clock";
import { matchingAreaTier, parseAreaTier } from "../src/core/pricing/areaTier";
import { buildQuote, estimateRange, humanReviewForCategory } from "../src/core/pricing/quote";
import { roundMoney } from "../src/config/revenue";
import { cleaningAreaTiers, quoteFactsFromModel, quoteScopeFromDraft } from "../src/features/customer/homeModel";
import { HomeProfileSchema } from "../src/features/customer/homeProfile";

const TIERS = ["≤60 m²", "61–100 m²", "101–150 m²"];

describe("Santa Sofía home model", () => {
  const profile = HomeProfileSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "src/seed/demoProfile.json"), "utf8")));
  const model = profile.model!;

  it("puts 100.49 m² of built area in the catalog band above 100", () => {
    expect(parseAreaTier("≤60 m²")).toEqual({ min: 0, max: 60 });
    expect(parseAreaTier("61–100 m²")).toEqual({ min: 61, max: 100 });
    expect(matchingAreaTier(60, TIERS)).toBe("≤60 m²");
    expect(matchingAreaTier(100, TIERS)).toBe("61–100 m²");
    expect(matchingAreaTier(100.49, TIERS)).toBe("101–150 m²");
    expect(matchingAreaTier(101, TIERS)).toBe("101–150 m²");
    expect(matchingAreaTier(150, TIERS)).toBe("101–150 m²");
    expect(matchingAreaTier(150.01, TIERS)).toBeNull();
    expect(cleaningAreaTiers()).toEqual(TIERS);
    expect(quoteFactsFromModel(model)).toEqual({
      cleaningTier: "101–150 m²",
      minisplits: 1,
      bathrooms: 2,
      bedrooms: 3
    });
  });

  it("prices cleaning at that band, and a different band changes the total", () => {
    const home = quoteScopeFromDraft({ ...quoteFactsFromModel(model), selectedJobIds: ["FIXX-CLN-001"] });
    const quote = buildQuote("cleaning", false, home);
    const smaller = buildQuote("cleaning", false, { cleaningTier: "≤60 m²", taskIds: ["FIXX-CLN-001"] });
    expect(quote.tier).toBe("101–150 m²");
    expect(quote.taskId).toBe("FIXX-CLN-001");
    expect(smaller.tier).toBe("≤60 m²");
    expect(smaller.total).not.toBe(quote.total);
    expect(quote.lines.map((line) => line.id).every((id) => id === "mat" || id === "work" || id === "booking")).toBe(true);
    expect(quote.total).toBe(roundMoney(quote.materials + quote.labor + quote.bookingFee));
    expect(formatMXN(quote.total)).toMatch(/\$[\d,]+\.\d{2} MXN$/);
    const wide = estimateRange("cleaning", false, { cleaningTier: "101–150 m²" });
    const narrow = estimateRange("cleaning", false, { cleaningTier: "≤60 m²" });
    expect(wide.low).not.toBe(narrow.low);
  });

  it("uses one minisplit as the catalog quantity and scales when that count changes", () => {
    const one = buildQuote("hvac", false, { minisplits: 1, taskIds: ["FIXX-HVC-002"] });
    const two = buildQuote("hvac", false, { minisplits: 2, taskIds: ["FIXX-HVC-002"] });
    const reference = buildQuote("hvac", false, { taskIds: ["FIXX-HVC-002"] });
    expect(one.total).toBe(reference.total);
    expect(two.total).toBeGreaterThan(one.total);
    expect(formatMXN(two.total)).toMatch(/\.\d{2} MXN$/);
  });

  it("leaves other trades, centavos, and regulated review as they are", () => {
    const plain = buildQuote("painting", false);
    const withHome = buildQuote("painting", false, { cleaningTier: "101–150 m²", minisplits: 1 });
    expect(withHome).toEqual(plain);
    expect(humanReviewForCategory("pest_control").some((item) => item.reason === "regulated")).toBe(true);
    const electrical = buildQuote("electrical", false);
    const electricalWithCount = buildQuote("electrical", false, { minisplits: 2 });
    expect(electricalWithCount).toEqual(electrical);
  });
});
