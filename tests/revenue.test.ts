import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatMXN } from "../src/core/clock/clock";
import {
  bookingFee, CARD_FEE_IVA, laborAfterCommission, laborCommission, materialsPrice, payoutFloor, proLaborPayout, revenue, roundMoney, wageFloorForDays
} from "../src/config/revenue";
import { quoteTask, quoteVisit, type Catalog } from "../src/core/pricing/instantQuote";
import { customerLines } from "../src/core/pricing/quote";

const cat = JSON.parse(readFileSync(join(process.cwd(), "src/seed/pricing/catalog.json"), "utf8")) as Catalog;
const quote = (taskId: string, tier: string) => quoteTask(cat, { taskId, tier, urgency: "STANDARD" });

describe("revenue rates", () => {
  it("keeps the materials rate and the labor share in one config", () => {
    expect(revenue.materialsMarkup).toBe(0.05);
    expect(revenue.proCommission).toBe(0.15);
    expect(revenue.cardFeePct).toBe(0.036);
    expect(CARD_FEE_IVA).toBe(1.16);
    expect(revenue.floorScalesWithUrgency).toBe(true);
    expect(revenue.rounding).toEqual({ decimals: 2, mode: "half-up" });
    expect(cat.urgency.map((u) => u.multiplier)).toEqual([1, 1.15, 1.3, 1.5]);
  });

  it("does not add IVA again; a before-tax price was already grossed up in the catalog", () => {
    const cement = cat.items["CON-M08"]!;
    expect(cement.iva).toBe("+16% added");
    expect(cement.price).toBe(280.72);
    expect(cement.price).not.toBeCloseTo(280.72 * 1.16, 2);
    const task = Object.values(cat.tasks).find((t) => t.lines.some((l) => l.itemId === "CON-M08" && l.unitPrice != null));
    const line = task?.lines.find((l) => l.itemId === "CON-M08");
    expect(line?.unitPrice).toBe(280.72);
  });

  it("scales the wage floor with urgency for payout and the booking fee", () => {
    expect(payoutFloor(363.44, 1.3)).toBe(roundMoney(363.44 * 1.3));
    expect(payoutFloor(363.44, 1)).toBe(363.44);
    const tasks = ["FIXX-CAR-001", "FIXX-ELC-001", "FIXX-ELC-002", "FIXX-GRD-001", "FIXX-GRD-002", "FIXX-GRD-003"];
    for (const taskId of tasks) {
      for (const tier of cat.tasks[taskId]!.tiers) {
        const x = quote(taskId, tier);
        const exported = cat.labor[x.laborKey]!.floor!;
        expect(x.floor).toBe(exported);
        const used = payoutFloor(exported, x.multiplier);
        expect(laborAfterCommission(x.labor)).toBeLessThan(used);
        expect(x.payout).toBe(used);
        expect(x.bookingFee).toBe(bookingFee(x.labor, used));
        expect(x.bookingFee).toBeGreaterThan(0);
        const urgent = quoteTask(cat, { taskId, tier, urgency: "HIGH" });
        const urgentFloor = payoutFloor(exported, urgent.multiplier);
        expect(urgent.floor).toBe(exported);
        expect(urgentFloor).toBe(roundMoney(exported * 1.3));
        expect(urgent.payout).toBe(proLaborPayout(urgent.labor, urgentFloor));
        expect(urgent.bookingFee).toBe(bookingFee(urgent.labor, urgentFloor));
      }
    }
  });

  it("prices materials with the markup and the card-fee gross-up, once", () => {
    const raw = 159.1;
    const divisor = 1 - revenue.cardFeePct * CARD_FEE_IVA;
    expect(materialsPrice(raw)).toBe(roundMoney(raw * (1 + revenue.materialsMarkup) / divisor));
    expect(materialsPrice(raw)).toBe(174.34);
    expect(materialsPrice(100)).toBe(109.58);
    expect(materialsPrice(materialsPrice(raw))).not.toBe(materialsPrice(raw));
    const x = quote("FIXX-PLM-001", "Budget");
    expect(x.materialsRaw).toBeCloseTo(raw, 2);
    expect(x.materials).toBe(materialsPrice(x.materialsRaw));
    expect(x.labor).toBe(800);
    expect(x.bookingFee).toBe(0);
    expect(x.total).toBe(974.34);
    expect(x.total).toBe(roundMoney(x.labor + x.materials + x.bookingFee));
  });

  it("keeps FIXX's labor share and adds a booking fee only when the floor is higher", () => {
    expect(laborCommission(800)).toBe(120);
    expect(proLaborPayout(800, 349.84)).toBe(680);
    expect(bookingFee(800, 349.84)).toBe(0);
    const x = quote("FIXX-PLM-001", "Budget");
    expect(x.payout).toBe(680);
    expect(x.bookingFee).toBe(0);
    expect(customerLines(x).some((l) => l.id === "booking")).toBe(false);
    expect(x.total).toBe(roundMoney(x.labor + x.materials + x.bookingFee));
    expect(x.payout).toBeLessThan(x.labor);

    const outlet = quote("FIXX-ELC-001", "Budget");
    expect(outlet.labor).toBe(375);
    expect(outlet.floor).toBe(356.19);
    expect(laborAfterCommission(outlet.labor)).toBe(318.75);
    expect(outlet.bookingFee).toBe(37.44);
    expect(outlet.payout).toBe(356.19);
    expect(outlet.total).toBe(roundMoney(outlet.materials + outlet.labor + outlet.bookingFee));
    expect(customerLines(outlet)).toContainEqual({ id: "booking", amount: 37.44 });
  });

  it("ELC-001 Emergency keeps the catalog floor unscaled and prices the scaled shortfall", () => {
    const x = quoteTask(cat, { taskId: "FIXX-ELC-001", tier: "Budget", urgency: "EMERGENCY" });
    expect(x.multiplier).toBe(1.5);
    expect(x.floor).toBe(356.19);
    expect(x.floor).toBe(cat.labor[x.laborKey]!.floor);
    expect(x.labor).toBe(562.5);
    // 356.19 × 1.50 = 534.285. Half-up to the centavo is 534.29.
    // A reference check quoted payout 534.28, which is that product cut off at the centavo.
    expect(x.payout).toBe(534.29);
    expect(x.payout).toBe(payoutFloor(x.floor, x.multiplier));
    expect(x.bookingFee).toBe(56.16);
    expect(x.bookingFee).toBe(bookingFee(x.labor, x.payout));
    expect(customerLines(x)).toContainEqual({ id: "booking", amount: 56.16 });
    expect(x.total).toBe(roundMoney(x.materials + x.labor + x.bookingFee));
  });

  it("pays the cleaning wage floor per visit day when the labor share would go below it", () => {
    expect(cat.dailyMin["Domestic worker / cleaner"]).toBe(342.47);
    expect(wageFloorForDays(342.47, 1)).toBe(342.47);
    expect(wageFloorForDays(342.47, 2)).toBe(684.94);
    expect(proLaborPayout(400, 342.47)).toBe(342.47);
    expect(proLaborPayout(400, wageFloorForDays(342.47, 2))).toBe(684.94);

    const tier = cat.tasks["FIXX-CLN-001"]!.tiers[0]!;
    const small = quoteTask(cat, { taskId: "FIXX-CLN-001", tier, urgency: "STANDARD", scopeQty: 0.2 });
    expect(small.marketLabor).toBeLessThan(342.47);
    expect(small.floor).toBe(342.47);
    expect(small.labor).toBe(342.47);
    expect(small.payout).toBe(342.47);
    expect(small.bookingFee).toBe(bookingFee(small.labor, small.floor));
    expect(small.total).toBe(roundMoney(small.labor + small.materials + small.bookingFee));

    const wideTier = cat.tasks["FIXX-CLN-004"]!.tiers.find((name) => (cat.labor[`FIXX-CLN-004|${name}`]?.estJobDays ?? 0) >= 2)!;
    const twoDay = quote("FIXX-CLN-004", wideTier);
    expect(twoDay.floor).toBe(684.94);
    const day = quote("FIXX-CLN-001", tier);
    const visit = quoteVisit(cat, [{ taskId: "FIXX-CLN-001", tier }, { taskId: "FIXX-CLN-004", tier: wideTier }], "STANDARD");
    expect(visit.visitFloor).toBe(wageFloorForDays(342.47, day.estJobDays + twoDay.estJobDays));
    expect(visit.visitPayout).toBe(proLaborPayout(visit.visitLabor, payoutFloor(visit.visitFloor, visit.multiplier)));
    expect(visit.bookingFee).toBe(bookingFee(visit.visitLabor, payoutFloor(visit.visitFloor, visit.multiplier)));
    expect(visit.total).toBe(roundMoney(visit.materials + visit.visitLabor + visit.asNeeded + visit.bookingFee));
  });

  it("shows money as pesos and centavos", () => {
    expect(formatMXN(450)).toBe("$450.00 MXN");
    expect(formatMXN(materialsPrice(100))).toBe("$109.58 MXN");
  });

  it("records the refreshed copper line-set kit on the 1 t and 1.5 t install rows", () => {
    expect(cat.items["HVC-M13"]!.price).toBe(873.26);
    expect(quote("FIXX-HVC-001", "1 t").materialsRaw).toBe(1486.76);
    expect(quote("FIXX-HVC-001", "1.5 t").materialsRaw).toBe(1486.76);
  });
});
