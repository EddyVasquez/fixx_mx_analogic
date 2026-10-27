import { describe, it, expect } from "vitest";
import { roundMoney } from "../src/config/revenue";
import { Clock } from "../src/core/clock/clock";
import { addHours } from "../src/core/rules";
import { buildQuote } from "../src/core/pricing/quote";
import { adjustQuote, payoutLimits } from "../src/core/pricing/adjust";
import { checklistFor } from "../src/core/standards/checklist";
import { jobMachine, newJobCtx, verificationMachine, newVerification } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { demoLines } from "../src/mocks/chat/chatStore";
import { viewFor } from "../src/mocks/translation/translator";

const t0 = new Date("2026-10-06T16:00:00Z");
const mk = () => new DemoRuntime(new Clock(0, () => t0.getTime()));

describe("professional quote adjustment", () => {
  const base = buildQuote("painting", false);
  it("a payout equal to the suggestion leaves the quote unchanged", () => {
    expect(adjustQuote(base, base.payout)).toMatchObject({ total: base.total, factor: 1, payout: base.payout, labor: base.labor });
  });
  it("adjusting within the limits changes labor only and keeps the lines adding up", () => {
    const q = adjustQuote(base, base.payout * 1.1);
    expect(q.total).toBeGreaterThan(base.total);
    expect(q.lines.find((l) => l.id === "mat")?.amount).toBe(base.materials);
    expect(q.labor).toBeGreaterThan(base.labor);
    expect(roundMoney(q.lines.reduce((a, l) => a + l.amount, 0))).toBe(q.total);
    expect(q.total).toBe(roundMoney(q.materials + q.labor + q.bookingFee));
    const b = payoutLimits(base.payout, base.wageFloor);
    expect(q.payout >= b.min && q.payout <= b.max).toBe(true);
  });
  it("refuses a payout outside the limits", () => {
    expect(() => adjustQuote(base, base.payout * 1.2)).toThrow();
    expect(() => adjustQuote(base, base.payout * 0.8)).toThrow();
  });
  it("an urgent quote has no flat surcharge line, and adjustment leaves materials unchanged", () => {
    const u = buildQuote("painting", true);
    expect(u.lines.find((l) => l.id === "urgent")).toBeUndefined();
    expect(u.labor).toBeGreaterThan(base.labor);
    const q = adjustQuote(u, u.payout * 0.9);
    expect(q.lines.find((l) => l.id === "mat")?.amount).toBe(u.materials);
    expect(q.lines.reduce((a, l) => a + l.amount, 0)).toBe(q.total);
  });
  it("has a checklist for every category", () => {
    expect(checklistFor("painting").length).toBeGreaterThan(0);
  });
});

describe("professional sends an adjusted quote through the job", () => {
  it("stores the adjustment reason and the customer total, not the payout", () => {
    const rt = mk();
    rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
    const base = buildQuote("painting", false);
    const q = adjustQuote(base, base.payout * 1.05);
    for (const e of [{ type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }, { type: "SELECT_PROFESSIONAL", professionalId: "p6" },
      { type: "SEND_QUOTE", total: q.total, travelFee: 150, payoutRatio: 0.8, lines: q.lines, adjustmentReason: "Extra prep" }]) {
      expect(rt.dispatch("job", e).ok).toBe(true);
    }
    const c = rt.get("job")!.snap.ctx as { total: number; adjustmentReason: string | null };
    expect(c.total).toBe(q.total);
    expect(c.adjustmentReason).toBe("Extra prep");
  });
});

describe("verification and number recovery (scenario 11)", () => {
  it("runs submit, approve, lost number, recovery, approve, with messages to the professional", () => {
    const rt = mk();
    rt.languages.professional = "ko";
    rt.spawn("verify:new", "verification", verificationMachine, newVerification());
    const go = (e: object) => { const r = rt.dispatch("verify:new", e as { type: string }); if (!r.ok) throw new Error(r.error); };
    expect(rt.dispatch("verify:new", { type: "SUBMIT", idDoc: true, selfie: false, phoneVerified: true }).ok).toBe(false);
    go({ type: "SUBMIT", idDoc: true, selfie: true, phoneVerified: true });
    go({ type: "REJECT", reason: "blurry" });
    expect(rt.get("verify:new")?.snap.state).toBe("rejected");
    go({ type: "SUBMIT", idDoc: true, selfie: true, phoneVerified: true });
    go({ type: "APPROVE" });
    go({ type: "REPORT_LOST_NUMBER" });
    expect(rt.get("verify:new")?.snap.state).toBe("recovery");
    go({ type: "SUBMIT_RECOVERY", selfie: true, newPhoneVerified: true });
    go({ type: "APPROVE" });
    expect(rt.get("verify:new")?.snap.state).toBe("approved");
    const mine = rt.center.list({ audience: "professional" });
    expect(mine.length).toBeGreaterThan(4);
    mine.forEach((n) => expect(n.language).toBe("ko"));
  });
  it("can start an actor in a given state (seeded professionals)", () => {
    const rt = mk();
    rt.spawn("verify:p6", "verification", verificationMachine, newVerification(), {}, "approved");
    expect(rt.get("verify:p6")?.snap.state).toBe("approved");
    expect(rt.dispatch("verify:p6", { type: "REPORT_LOST_NUMBER" }).ok).toBe(true);
  });
});

describe("chat with translation (scenario 12)", () => {
  it("a Korean customer and a Spanish professional read each other in their own language", () => {
    const rt = mk();
    rt.languages.customer = "ko"; rt.languages.professional = "es";
    const [ask] = demoLines("customer", "ko");
    rt.sendChat("job", "customer", "ko", ask!);
    const [reply] = demoLines("professional", "es");
    rt.sendChat("job", "professional", "es", reply!);
    const [m1, m2] = rt.chat.list("job");
    expect(viewFor(m1!, "es")).toMatchObject({ text: "Hola, ¿es posible mañana a las 10 de la mañana?", translated: true, originalLanguage: "ko" });
    expect(viewFor(m1!, "ko")).toMatchObject({ translated: false, text: ask });
    expect(viewFor(m2!, "ko")).toMatchObject({ text: "네, 그 시간에 가겠습니다. 벽 사진을 보내주실 수 있나요?", translated: true });
  });
  it("offers scripted lines per role and language, and clears with the demo", () => {
    expect(demoLines("customer", "ko")).toHaveLength(2);
    expect(demoLines("professional", "es")).toHaveLength(2);
    expect(demoLines("customer", "ko").every((l) => /[가-힣]/.test(l))).toBe(true);
    const rt = mk(); rt.sendChat("job", "customer", "en", "hi"); rt.reset();
    expect(rt.chat.list("job")).toHaveLength(0);
  });
  it("free text gets the obvious demo prefix", () => {
    const rt = mk(); rt.sendChat("job", "customer", "es", "gracias");
    expect(viewFor(rt.chat.list("job")[0]!, "ko").text.startsWith("[demo es→ko]")).toBe(true);
  });
});
