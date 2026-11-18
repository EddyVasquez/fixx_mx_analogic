import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quoteTask, type Catalog, type UrgencyLevel } from "../src/core/pricing/instantQuote";

const cat = JSON.parse(readFileSync(join(process.cwd(), "src/seed/pricing/catalog.json"), "utf8")) as Catalog;
const csvPath = join(process.cwd(), "tests/fixtures/v29_billed_total_changes.csv");

describe("catalog v29", () => {
  it("steps the budget materials down and lifts the three cleaning labor rates by one centavo", () => {
    const faucet = cat.tasks["FIXX-PLM-003"]!.lines.find((line) => line.id === "L0277")!;
    const drain = cat.tasks["FIXX-PLM-006"]!.lines.find((line) => line.id === "L0019")!;
    expect(faucet).toMatchObject({ tier: "Budget", itemId: "PLM-K19", qty: 2, unitPrice: 59, type: "base" });
    expect(drain).toMatchObject({ tier: "Budget", itemId: "PLM-K20", qty: 1, unitPrice: 127, type: "base" });
    expect(cat.items["PLM-K19"]!.price).toBe(59);
    expect(cat.items["PLM-K20"]!.price).toBe(127);
    expect(quoteTask(cat, { taskId: "FIXX-PLM-003", tier: "Budget", urgency: "STANDARD" }).materialsRaw).toBe(118);
    expect(quoteTask(cat, { taskId: "FIXX-PLM-006", tier: "Budget", urgency: "STANDARD" }).materialsRaw).toBe(127);
    expect(cat.labor["FIXX-CLN-001|61–100 m²"]!.rateTypical).toBe(1165.03);
    expect(cat.labor["FIXX-CLN-002|≤60 m²"]!.rateTypical).toBe(1565.03);
    expect(cat.labor["FIXX-CLN-003|≤60 m²"]!.rateTypical).toBe(1265.03);
  });

  it("prices MTL-001 and PLM-007 at Standard urgency across the three tiers", () => {
    const totals = (taskId: string) =>
      (["Budget", "Standard", "Premium"] as const).map((tier) => quoteTask(cat, { taskId, tier, urgency: "STANDARD" }).total);
    expect(totals("FIXX-MTL-001")).toEqual([2242.42, 2435.55, 3097.39]);
    expect(totals("FIXX-PLM-007")).toEqual([1045.88, 1289.14, 2799.09]);
  });

  it("matches every billed total the v29 workbook changed", () => {
    const rows = readFileSync(csvPath, "utf8").trim().split(/\r?\n/).slice(1);
    expect(rows.length).toBeGreaterThan(300);
    const wrong = rows.flatMap((line) => {
      const [taskId, tier, urgency, , after] = line.split(",");
      const quote = quoteTask(cat, { taskId: taskId!, tier: tier!, urgency: urgency as UrgencyLevel });
      return quote.total === Number(after) ? [] : [`${taskId}|${tier}|${urgency} got ${quote.total} want ${after}`];
    });
    expect(wrong).toEqual([]);
  });
});
