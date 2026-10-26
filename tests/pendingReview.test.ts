import { describe, expect, it } from "vitest";
import catalogJson from "../src/seed/pricing/catalog.json";
import { quoteTask, type Catalog } from "../src/core/pricing/instantQuote";
import { humanReviewForCategory } from "../src/core/pricing/quote";

const cat = catalogJson as unknown as Catalog;

describe("category review before booking", () => {
  it("flags electrical by default and leaves cleaning and plumbing clear until a flagged line is selected", () => {
    expect(humanReviewForCategory("electrical").length).toBeGreaterThan(0);
    expect(humanReviewForCategory("pest_control").length).toBeGreaterThan(0);
    expect(humanReviewForCategory("cleaning")).toEqual([]);
    expect(humanReviewForCategory("plumbing")).toEqual([]);
    expect(humanReviewForCategory("painting")).toEqual([]);

    const mold = cat.tasks["FIXX-CLN-002"]!.lines.find((l) => l.tier === "≤60 m²" && l.itemId === "CLN-F02")!;
    expect(quoteTask(cat, { taskId: "FIXX-CLN-002", tier: "≤60 m²", urgency: "STANDARD" }).humanReview).toEqual([]);
    const withMold = quoteTask(cat, { taskId: "FIXX-CLN-002", tier: "≤60 m²", urgency: "STANDARD", asNeededLineIds: [mold.id] });
    expect(withMold.humanReview.map((h) => h.ref)).toEqual([mold.id]);

    const gas = cat.tasks["FIXX-PLM-004"]!.lines.find((l) => l.id === "L0024")!;
    expect(quoteTask(cat, { taskId: "FIXX-PLM-004", tier: "Standard", urgency: "STANDARD" }).humanReview).toEqual([]);
    const withGas = quoteTask(cat, { taskId: "FIXX-PLM-004", tier: "Standard", urgency: "STANDARD", asNeededLineIds: [gas.id] });
    expect(withGas.humanReview.map((h) => h.ref)).toContain("L0024");
  });
});
