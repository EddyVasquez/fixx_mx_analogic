import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Clock } from "../src/core/clock/clock";
import { config } from "../src/core/config/fixx.config";
import { addHours, bandFor, travelFeeFor, splitDepositBalance } from "../src/core/rules";
import { recommend, type ProLike, type ZoneLike } from "../src/core/matching/recommend";
import { roundMoney } from "../src/config/revenue";
import { estimateRange, buildQuote } from "../src/core/pricing/quote";
import { jobMachine, newJobCtx } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { chargeCard, DEMO_CARDS } from "../src/mocks/payments/gateway";

const seed = <T>(f: string) => JSON.parse(readFileSync(join(process.cwd(), `src/seed/${f}.json`), "utf8")) as T;
const pros = seed<ProLike[]>("professionals");
const zones = seed<ZoneLike[]>("zones");
const t0 = new Date("2026-10-06T16:00:00Z");

describe("recommendations", () => {
  it("returns at most 3 verified professionals who do the trade", () => {
    const r = recommend({ categoryId: "painting", customerZoneId: "z1", customerLang: "ko", professionals: pros, zones });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(3);
    r.forEach((x) => { const p = pros.find((q) => q.id === x.professionalId); expect(p?.trades.includes("painting")).toBe(true); expect(p?.verification).toBe("approved"); });
  });
  it("prefers a Korean-speaking professional in the same zone for a Korean customer", () => {
    const r = recommend({ categoryId: "painting", customerZoneId: "z1", customerLang: "ko", professionals: pros, zones });
    expect(r[0]?.professionalId).toBe("p6");
    expect(r[0]?.reasons).toContain("sameZone");
    expect(r[0]?.reasons).toContain("speaksYourLanguage");
  });
  it("skips professionals whose verification is not approved", () => {
    const r = recommend({ categoryId: "electrical", customerZoneId: "z3", customerLang: "es", professionals: pros, zones });
    expect(r.some((x) => x.professionalId === "p7")).toBe(false);
  });
  it("an address outside Apodaca still gets language and quality matches", () => {
    expect(recommend({ categoryId: "plumbing", customerZoneId: null, customerLang: "es", professionals: pros, zones }).length).toBeGreaterThan(0);
  });
});

describe("estimate and quote", () => {
  it("painting's range is the lowest and highest catalog total, with no flat surcharge", () => {
    const r = estimateRange("painting", false);
    expect(r.surcharge).toBe(0);
    expect(r.low).toBeLessThan(r.high);
    const urgent = estimateRange("painting", true);
    expect(urgent.surcharge).toBe(0);
    expect(urgent.low).toBeGreaterThan(r.low);
    expect(urgent.high).toBeGreaterThan(r.high);
  });
  it("quote lines are materials, labor, and a booking fee only when that fee is above zero", () => {
    for (const cat of ["plumbing", "painting", "electrical", "concrete", "carpentry", "appliance", "roofing", "handyman", "locksmith", "cleaning"]) for (const urgent of [false, true]) {
      const q = buildQuote(cat, urgent);
      const ids = q.bookingFee > 0 ? ["mat", "work", "booking"] : ["mat", "work"];
      expect(q.lines.map((l) => l.id)).toEqual(ids);
      if (q.bookingFee > 0) expect(q.lines.find((l) => l.id === "booking")?.amount).toBe(q.bookingFee);
      expect(roundMoney(q.lines.reduce((s, l) => s + l.amount, 0))).toBe(q.total);
      expect(q.total).toBe(roundMoney(q.materials + q.labor + q.bookingFee));
    }
  });
  it("splits the deposit and balance", () => {
    const q = buildQuote("painting", false);
    const s = splitDepositBalance(q.total);
    expect(s.deposit + s.balance).toBe(q.total);
  });
});

describe("customer happy path, headless (scenario 1)", () => {
  it("runs from request to rated with a card", () => {
    const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
    rt.languages.customer = "ko"; rt.languages.professional = "ko";
    rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
    const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error(r.error); };
    const rec = recommend({ categoryId: "painting", customerZoneId: "z1", customerLang: "ko", professionals: pros, zones });
    const pro = pros.find((p) => p.id === rec[0]?.professionalId)!;
    const quote = buildQuote("painting", false);
    const fee = travelFeeFor(bandFor(pro.zoneId, "z1", zones));
    go({ type: "ESTIMATE_READY" }); go({ type: "RECOMMENDATIONS_READY" });
    go({ type: "SELECT_PROFESSIONAL", professionalId: pro.id });
    go({ type: "SEND_QUOTE", total: quote.total, travelFee: fee, payoutRatio: 0.8, lines: quote.lines });
    go({ type: "ACCEPT_QUOTE", method: "card", jobStart: addHours(rt.clock.now(), 30) });
    const ctx = () => rt.get("job")!.snap.ctx as { initialDue: number; total: number };
    expect(chargeCard(DEMO_CARDS.approved, ctx().initialDue)).toEqual({ ok: true });
    go({ type: "PAYMENT_SATISFIED", amount: ctx().initialDue });
    rt.advanceHours(30);
    for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK", "CHECKLIST_COMPLETE", "MARK_COMPLETE", "BALANCE_PAID"]) go({ type: e });
    rt.advanceHours(config.completionCheck.autoReleaseHours);
    expect(rt.get("job")?.snap.state).toBe("paymentReleased");
    go({ type: "RATE" });
    expect(rt.get("job")?.snap.state).toBe("rated");
    expect(rt.get("warranty:job")?.snap.state).toBe("running");
    const customerKo = rt.center.list({ audience: "customer" });
    expect(customerKo.length).toBeGreaterThan(5);
    customerKo.forEach((n) => expect(n.language).toBe("ko"));
  });
});
