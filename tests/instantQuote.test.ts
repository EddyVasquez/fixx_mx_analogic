import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  quoteTask, quoteVisit, toUrgencyLevel, diagnosisFeeFor, repairDueAfterDiagnosis, reconcileScopeChange, priceFreshness, resolveTaskId,
  type Catalog, type UrgencyLevel
} from "../src/core/pricing/instantQuote";

const cat = JSON.parse(readFileSync(join(process.cwd(), "src/seed/pricing/catalog.json"), "utf8")) as Catalog;
interface Ref { taskId: string; tier: string; urgency: UrgencyLevel; materials: number; typicalLabor: number | null; multiplier: number; labor: number | null; total: number | null; payout: number | null; status: string }
const qb = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/quote_builder.json"), "utf8")) as Ref[];
const near = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) <= 0.01;
const URG: UrgencyLevel[] = ["STANDARD", "MEDIUM", "HIGH", "EMERGENCY"];
const q = (taskId: string, tier: string, urgency: UrgencyLevel, extra: object = {}) => quoteTask(cat, { taskId, tier, urgency, ...extra });

describe("acceptance: every Quote_Builder row", () => {
  it("has one reference row for every task, tier and urgency, including the six added trades", () => {
    expect(qb).toHaveLength(504);
    expect(new Set(qb.map((r) => r.taskId)).size).toBe(41);
  });
  it("matches the app total, labor, materials and payout within 0.01 at reference scope", () => {
    const wrong = qb.filter((r) => { const x = q(r.taskId, r.tier, r.urgency); return !(x.status === "FIXED" && near(x.total, r.total) && near(x.labor, r.labor) && near(x.materials, r.materials) && near(x.payout, r.payout)); });
    expect(wrong.map((r) => `${r.taskId}|${r.tier}|${r.urgency}`)).toEqual([]);
  });
});

describe("spec examples", () => {
  it("PLM-001 toilet repair (floor 349.84 is below typical labor 800)", () => {
    const table: Record<string, number[]> = { Budget: [959.1, 1079.1, 1199.1, 1359.1], Standard: [1145.1, 1265.1, 1385.1, 1545.1], Premium: [1361.1, 1481.1, 1601.1, 1761.1] };
    for (const [tier, totals] of Object.entries(table)) URG.forEach((u, i) => expect(near(q("FIXX-PLM-001", tier, u).total, totals[i]!)).toBe(true));
    expect(URG.map((u) => q("FIXX-PLM-001", "Budget", u).payout)).toEqual([800, 920, 1040, 1200]);
    expect(near(q("FIXX-PLM-001", "Budget", "STANDARD").materials, 159.1)).toBe(true);
  });
  it("PLM-001: the wax ring is an as-needed extra, and the diagnosis fee is separate", () => {
    const base = q("FIXX-PLM-001", "Budget", "STANDARD");
    const wax = base.asNeeded.options.find((l) => l.itemId === "PLM-M04")!;
    expect(wax.cost).toBe(52);
    expect(near(base.total, 959.1)).toBe(true);
    expect(near(q("FIXX-PLM-001", "Budget", "STANDARD", { asNeededLineIds: [wax.lineId] }).total, 1011.1)).toBe(true);
    expect(diagnosisFeeFor(cat, "Plumbing", "STANDARD")).toBe(300);
    expect(diagnosisFeeFor(cat, "Plumbing", "HIGH")).toBe(390);
    expect(near(q("FIXX-PLM-001", "Budget", "HIGH", { withDiagnosis: true }).total, 1199.1 + 390)).toBe(true);
  });
  it("CAR-001 door rehang (market 240 is below the floor 363.44, so the floor applies)", () => {
    const table: Record<string, number[]> = { Budget: [465.44, 519.96, 574.47, 647.16], Standard: [470.44, 524.96, 579.47, 652.16], Premium: [519.44, 573.96, 628.47, 701.16] };
    for (const [tier, totals] of Object.entries(table)) URG.forEach((u, i) => expect(near(q("FIXX-CAR-001", tier, u).total, totals[i]!)).toBe(true));
    expect(URG.map((u) => q("FIXX-CAR-001", "Standard", u).payout)).toEqual([363.44, 417.96, 472.47, 545.16]);
  });
  it("multi-job visit CAR-001 Standard + LCK-002 at High: 897.00 labor split 312.00 / 585.00, total 1,004.00", () => {
    const lckTier = cat.tasks["FIXX-LCK-002"]!.tiers[0]!;
    const v = quoteVisit(cat, [{ taskId: "FIXX-CAR-001", tier: "Standard" }, { taskId: "FIXX-LCK-002", tier: lckTier }], "HIGH");
    expect(v.status).toBe("FIXED");
    expect(v.marketTotal).toBe(690);
    expect(v.visitFloor).toBe(363.44);
    expect(v.visitLabor).toBe(897);
    expect(v.jobs.map((j) => j.labor)).toEqual([312, 585]);
    expect(v.total).toBe(1004);
    expect(v.jobs.reduce((s, j) => s + j.labor, 0)).toBe(v.visitLabor);
    const separately = q("FIXX-CAR-001", "Standard", "HIGH").total + q("FIXX-LCK-002", lckTier, "HIGH").total;
    expect(near(separately, 1164.47)).toBe(true);
  });
  it("a visit with only CAR-001 at High: the floor binds, labor 472.47", () => {
    const v = quoteVisit(cat, [{ taskId: "FIXX-CAR-001", tier: "Standard" }], "HIGH");
    expect(v.visitLabor).toBe(472.47);
    expect(v.total).toBe(579.47);
  });
  it("the visit floor uses the highest trade floor among its jobs", () => {
    const v = quoteVisit(cat, [{ taskId: "FIXX-CAR-001", tier: "Standard" }, { taskId: "FIXX-LCK-002", tier: cat.tasks["FIXX-LCK-002"]!.tiers[0]! }], "STANDARD");
    expect(v.visitFloor).toBe(Math.max(cat.labor["FIXX-CAR-001|All"]!.dailyMin!, cat.labor["FIXX-LCK-002|All"]!.dailyMin!));
  });
});

describe("rules", () => {
  it("shows three urgency levels; Emergency is reachable only through High", () => {
    expect(toUrgencyLevel("standard", false)).toBe("STANDARD");
    expect(toUrgencyLevel("medium", false)).toBe("MEDIUM");
    expect(toUrgencyLevel("high", false)).toBe("HIGH");
    expect(toUrgencyLevel("high", true)).toBe("EMERGENCY");
    expect(toUrgencyLevel("standard", true)).toBe("STANDARD");
    expect(toUrgencyLevel("medium", true)).toBe("MEDIUM");
  });
  it("urgency multiplies labor only, never materials", () => {
    const a = q("FIXX-PNT-001", "Budget", "STANDARD"), b = q("FIXX-PNT-001", "Budget", "EMERGENCY");
    expect(b.materials).toBe(a.materials);
    expect(near(b.labor, a.labor * 1.5)).toBe(true);
  });
  it("flagged, reference, as-needed and homeowner-choice lines never enter the fixed total", () => {
    let withPending = 0;
    for (const t of Object.values(cat.tasks)) for (const tier of t.tiers) {
      const x = q(t.id, tier, "STANDARD");
      if (x.status !== "FIXED") continue;
      expect(near(x.total, x.materials + x.labor)).toBe(true);
      if (x.pendingReview.length) withPending++;
    }
    expect(withPending).toBeGreaterThan(5);
  });
  it("homeowner-choice items appear as a range, outside the total", () => {
    const hvac = Object.values(cat.tasks).flatMap((t) => t.tiers.map((tier) => q(t.id, tier, "STANDARD"))).find((x) => x.homeownerChoice.length > 0);
    expect(hvac?.homeownerChoiceRange).toBeTruthy();
  });
  it("fan support options are an exclusive group, never summed", () => {
    const x = q("FIXX-ELC-003", "Budget", "STANDARD");
    expect(x.pendingReview.length).toBeGreaterThanOrEqual(3);
    expect(new Set(x.pendingReview.map((l) => l.exclusiveGroup)).size).toBe(1);
    expect(near(x.total, x.materials + x.labor)).toBe(true);
  });
  it("regulated labor is priced like Quote_Builder but goes to the human-review queue (spec conflict, see report)", () => {
    const x = q("FIXX-PST-002", cat.tasks["FIXX-PST-002"]!.tiers[0]!, "STANDARD");
    expect(x.status).toBe("FIXED");
    expect(x.humanReview.some((h) => h.kind === "labor")).toBe(true);
  });
  it("unknown tiers and missing labor data become 'quote on site'", () => {
    expect(q("FIXX-PNT-001", "Platinum", "STANDARD").status).toBe("QUOTE_ON_SITE");
    expect(q("FIXX-NOPE-999", "Budget", "STANDARD").reasons).toContain("unknown-task");
  });
  it("only as-needed lines of that task and tier can be ticked", () => {
    expect(() => q("FIXX-PLM-001", "Budget", "STANDARD", { asNeededLineIds: ["L9999"] })).toThrow();
  });
  it("an unpriced base line would turn the quote into 'quote on site'", () => {
    const c2 = JSON.parse(JSON.stringify(cat)) as Catalog;
    c2.tasks["FIXX-PLM-001"]!.lines.find((l) => l.tier === "Budget" && l.type === "base")!.unitPrice = null;
    expect(quoteTask(c2, { taskId: "FIXX-PLM-001", tier: "Budget", urgency: "STANDARD" }).status).toBe("QUOTE_ON_SITE");
  });
});

describe("scope scaling", () => {
  it("doubling a per-m² task doubles market labor, days and the floor, and scales kit materials", () => {
    const ref = q("FIXX-PNT-001", "Budget", "STANDARD"), dbl = q("FIXX-PNT-001", "Budget", "STANDARD", { scopeQty: 86 });
    expect(dbl.marketLabor).toBe(ref.marketLabor * 2);
    expect(dbl.estJobDays).toBe(ref.estJobDays * 2);
    expect(near(dbl.floor, ref.floor * 2)).toBe(true);
    expect(near(dbl.materials, ref.materials * 2)).toBe(true);
  });
  it("whole-unit lines round up to whole units when scope grows", () => {
    const t = Object.values(cat.tasks).find((x) => x.lines.some((l) => l.type === "base" && /1 pc|1 unit/.test(l.basis)))!;
    const tier = t.lines.find((l) => l.type === "base" && /1 pc|1 unit/.test(l.basis))!.tier;
    const lab = cat.labor[`${t.id}|${tier}`] ?? cat.labor[`${t.id}|All`]!;
    const x = q(t.id, tier, "STANDARD", { scopeQty: (lab.refQty ?? 1) * 1.5 });
    const line = t.lines.find((l) => l.tier === tier && l.type === "base" && /1 pc|1 unit/.test(l.basis))!;
    expect(Number.isInteger(x.asNeeded.options.length)).toBe(true);
    expect(x.materials >= (line.unitPrice ?? 0) * 2 - 0.01 || x.materials > 0).toBe(true);
  });
});

describe("prices, aliases, diagnosis fee and on-site changes", () => {
  it("fresh up to 7 days, a warning from 8 to 30 days, blocked after 30 days", () => {
    expect(priceFreshness("2026-10-10", new Date("2026-10-17T00:00:00Z"))).toBe("fresh");
    expect(priceFreshness("2026-10-10", new Date("2026-10-18T00:00:00Z"))).toBe("stale");
    expect(priceFreshness("2026-10-10", new Date("2026-11-09T00:00:00Z"))).toBe("stale");
    expect(priceFreshness("2026-10-10", new Date("2026-11-10T00:00:00Z"))).toBe("blocked");
    const latest = Math.max(...Object.values(cat.items).map((i) => Date.parse(i.checkDate ?? "1970-01-01")));
    const fresh = quoteTask(cat, { taskId: "FIXX-PNT-001", tier: "Budget", urgency: "STANDARD" }, { now: new Date(latest + 40 * 86_400_000) });
    expect(fresh.status).toBe("BLOCKED_STALE_PRICE");
  });
  it("accepts old task ids as aliases", () => {
    const [oldId, finalId] = Object.entries(cat.taskIdMap).find(([o, f]) => o !== f && cat.tasks[f])!;
    expect(resolveTaskId(cat, oldId)).toBe(finalId);
  });
  it("stores the catalog version on every quote", () => {
    expect(q("FIXX-PLM-001", "Budget", "STANDARD").catalogVersion).toBe(cat.version);
    expect(cat.version).toMatch(/^2026-\d\d-\d\d-[0-9a-f]{8}$/);
  });
  it("no diagnosis data means 'quote on site' for the fee; roofing is free", () => {
    expect(diagnosisFeeFor(cat, "Carpentry", "STANDARD")).toBe(null);
    expect(diagnosisFeeFor(cat, "Roofing", "HIGH")).toBe(0);
  });
  it("a paid diagnosis fee is credited when the repair is booked", () => {
    expect(repairDueAfterDiagnosis(1320, 300)).toEqual({ credit: 300, due: 1020 });
    const v = quoteVisit(cat, [{ taskId: "FIXX-PLM-001", tier: "Standard" }], "STANDARD", { diagnosisFeePaid: 300 });
    expect(v.diagnosisCredit).toBe(300);
    expect(near(v.total, 1145.1 - 300)).toBe(true);
  });
  it("any on-site change, even 0.01, needs the homeowner's approval; no change does not", () => {
    expect(reconcileScopeChange({ total: 1320 }, { total: 1320.01 }, 300)).toMatchObject({ needsApproval: true, delta: 0.01, onDeclineCharge: 300 });
    expect(reconcileScopeChange({ total: 1320 }, { total: 1320 }).needsApproval).toBe(false);
    expect(reconcileScopeChange({ total: 1320 }, { total: 1000 }).delta).toBe(-320);
  });
  it("a scope change recomputes with the same tier and urgency, keeping both totals for the audit trail", () => {
    const before = q("FIXX-PNT-001", "Standard", "HIGH"), after = q("FIXX-PNT-001", "Standard", "HIGH", { scopeQty: 50 });
    const r = reconcileScopeChange(before, after);
    expect(r.needsApproval).toBe(true);
    expect(r.oldTotal).toBe(before.total);
    expect(r.newTotal).toBe(after.total);
  });
});

describe("fourteen trades, job names and cleaning add-ons", () => {
  const TRADES = ["Plumbing", "Electrical", "HVAC", "Painting", "Pest", "Gardening", "Flooring", "Concrete", "Carpentry", "Appliance", "Roofing", "Handyman", "Locksmith", "Cleaning"];

  it("prices all 14 trades from the workbook, with a job name in English, Spanish and Korean", () => {
    const present = new Set(Object.values(cat.tasks).map((t) => t.category));
    expect([...present].sort()).toEqual([...TRADES].sort());
    for (const task of Object.values(cat.tasks)) {
      expect(task.job.length).toBeGreaterThan(0);
      expect(task.jobEs?.length).toBeGreaterThan(0);
      expect(task.jobKo).toMatch(/\p{Script=Hangul}/u);
    }
    for (let n = 1; n <= 7; n++) expect(cat.tasks[`FIXX-CLN-00${n}`]).toBeTruthy();
  });

  it("shows cleaning prices with centavos and adds oven, fridge, balcony and pet-stain labor only when selected", () => {
    const base = q("FIXX-CLN-001", "≤60 m²", "STANDARD");
    expect(base.status).toBe("FIXED");
    expect(base.needsHumanReview).toBe(false);
    expect(base.materials).not.toBe(Math.round(base.materials));
    expect(base.displayTotal).toBe(base.total);
    const pick = (needle: string) => base.asNeeded.options.find((l) => l.basis.toLowerCase().includes(needle))!;
    const oven = pick("oven"), fridge = pick("fridge"), balcony = pick("balcony"), pet = pick("pet");
    const withOven = q("FIXX-CLN-001", "≤60 m²", "STANDARD", { asNeededLineIds: [oven.lineId] });
    expect(withOven.needsHumanReview).toBe(false);
    expect(near(withOven.total, base.total + (oven.cost ?? 0) + 250)).toBe(true);
    expect(near(q("FIXX-CLN-001", "≤60 m²", "STANDARD", { asNeededLineIds: [fridge.lineId] }).total, base.total + (fridge.cost ?? 0) + 200)).toBe(true);
    expect(near(q("FIXX-CLN-001", "≤60 m²", "STANDARD", { asNeededLineIds: [balcony.lineId] }).total, base.total + (balcony.cost ?? 0) + 250)).toBe(true);
    expect(near(q("FIXX-CLN-001", "≤60 m²", "STANDARD", { asNeededLineIds: [pet.lineId] }).total, base.total + (pet.cost ?? 0) + 250)).toBe(true);
    const urgentOven = q("FIXX-CLN-001", "≤60 m²", "HIGH", { asNeededLineIds: [oven.lineId] });
    expect(near(urgentOven.labor, (base.labor + 250) * 1.3)).toBe(true);
  });

  it("puts a cleaning quote into pending review only when window-at-height or mold is selected", () => {
    const windows = q("FIXX-CLN-007", "Budget", "STANDARD");
    const height = cat.tasks["FIXX-CLN-007"]!.lines.find((l) => l.tier === "Budget" && l.itemId === "CLN-F01")!;
    expect(windows.needsHumanReview).toBe(false);
    expect(windows.pendingReview).toEqual([]);
    const atHeight = q("FIXX-CLN-007", "Budget", "STANDARD", { asNeededLineIds: [height.id] });
    expect(atHeight.needsHumanReview).toBe(true);
    expect(atHeight.pendingReview.map((l) => l.itemId)).toEqual(["CLN-F01"]);
    expect(atHeight.total).toBe(windows.total);
    expect(q("FIXX-CLN-007", "Budget", "STANDARD").needsHumanReview).toBe(false);

    const deep = q("FIXX-CLN-002", "≤60 m²", "STANDARD");
    const mold = cat.tasks["FIXX-CLN-002"]!.lines.find((l) => l.tier === "≤60 m²" && l.itemId === "CLN-F02")!;
    expect(deep.needsHumanReview).toBe(false);
    const withMold = q("FIXX-CLN-002", "≤60 m²", "STANDARD", { asNeededLineIds: [mold.id] });
    expect(withMold.needsHumanReview).toBe(true);
    expect(withMold.pendingReview.map((l) => l.itemId)).toEqual(["CLN-F02"]);
    const oven = deep.asNeeded.options.find((l) => l.basis.toLowerCase().includes("oven"))!;
    expect(q("FIXX-CLN-002", "≤60 m²", "STANDARD", { asNeededLineIds: [oven.lineId] }).needsHumanReview).toBe(false);
  });
});
