import { describe, it, expect } from "vitest";
import { Clock } from "../src/core/clock/clock";
import { addHours } from "../src/core/rules";
import { jobMachine, newJobCtx } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";

const t0 = new Date("2026-10-06T16:00:00Z");
const LINES = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "work", amount: 2200 }];

/** A card job taken to the issue window, with one issue reported. */
function reported(selected: string[] | "wholeJob", method: "card" | "cash" = "card") {
  const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
  rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
  const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error((e as { type: string }).type + ": " + r.error); };
  for (const e of [{ type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }, { type: "SELECT_PROFESSIONAL", professionalId: "p6" },
    { type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines: LINES },
    { type: "ACCEPT_QUOTE", method, jobStart: addHours(t0, 30) }, { type: "PAYMENT_SATISFIED", amount: 840 }]) go(e);
  if (method === "cash") go({ type: "BALANCE_PAID" });
  rt.advanceHours(30);
  for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK", "CHECKLIST_COMPLETE", "MARK_COMPLETE"]) go({ type: e });
  if (method === "card") go({ type: "BALANCE_PAID" });
  rt.advanceHours(2);
  go({ type: "REPORT_ISSUE", selected });
  const kase = (e: object) => { const r = rt.dispatch("case:job", e as { type: string }); if (!r.ok) throw new Error((e as { type: string }).type + ": " + r.error); };
  return { rt, go, kase, job: () => rt.get("job")!.snap.state, cs: () => rt.get("case:job")!.snap };
}

describe("scenario 9: issue report, held amounts and the case", () => {
  it("selected items hold their cost; the professional sees the net share", () => {
    const { cs } = reported(["mat"]);
    expect(cs().ctx).toMatchObject({ heldAmount: 1400, heldPayout: 1120 });
  });
  it("the whole job holds the full amount", () => {
    expect(reported("wholeJob").cs().ctx).toMatchObject({ heldAmount: 4200, heldPayout: 3360 });
  });
  it("one review each, then final: the payment is released with the decision applied", () => {
    const { rt, kase, job, cs } = reported(["mat"]);
    kase({ type: "START_REVIEW" });
    rt.advanceHours(24);
    kase({ type: "DECIDE", decision: "refundCustomer" });
    kase({ type: "REQUEST_REVIEW", by: "customer" });
    kase({ type: "REVIEW_DECIDED", decision: "refundCustomer" });
    expect(cs().state).toBe("decided");
    expect(rt.dispatch("case:job", { type: "REQUEST_REVIEW", by: "customer" }).ok).toBe(false);
    kase({ type: "REQUEST_REVIEW", by: "professional" });
    kase({ type: "REVIEW_DECIDED", decision: "refundCustomer" });
    expect(cs().state).toBe("final");
    expect(job()).toBe("paymentReleased");
    expect(rt.refunds[0]).toMatchObject({ amount: 1400, destination: "original" });
    expect(rt.payouts[0]?.amount).toBe(3360 - 1120);
    expect(rt.get("warranty:job")?.snap.state).toBe("running");
  });
  it("releasing to the professional pays the held share in full", () => {
    const { rt, kase } = reported(["mat"]);
    kase({ type: "START_REVIEW" }); kase({ type: "DECIDE", decision: "releaseProfessional" });
    rt.advanceHours(24 * 15);
    expect(rt.payouts[0]?.amount).toBe(3360);
    expect(rt.refunds).toHaveLength(0);
  });
  it("a split refunds half to the customer", () => {
    const { rt, kase } = reported("wholeJob");
    kase({ type: "START_REVIEW" }); kase({ type: "DECIDE", decision: "split" });
    rt.advanceHours(24 * 15);
    expect(rt.refunds[0]?.amount).toBe(2100);
    expect(rt.payouts[0]?.amount).toBe(3360 - 1680);
  });
  it("with no review requested, the decision becomes final at the deadline and the job releases payment", () => {
    const { rt, kase, job, cs } = reported(["mat"]);
    kase({ type: "START_REVIEW" }); kase({ type: "DECIDE", decision: "refundCustomer" });
    rt.advanceHours(24 * 13);
    expect(cs().state).toBe("decided");
    rt.advanceHours(24 * 2);
    expect(cs().state).toBe("final");
    expect(job()).toBe("paymentReleased");
  });
  it("a review asked for after the deadline is refused", () => {
    const { rt, kase } = reported(["mat"]);
    kase({ type: "START_REVIEW" }); kase({ type: "DECIDE", decision: "refundCustomer" });
    rt.get("case:job")!.snap.ctx = { ...(rt.get("case:job")!.snap.ctx as object), reviewBy: addHours(rt.clock.now(), -1) };
    expect(rt.dispatch("case:job", { type: "REQUEST_REVIEW", by: "customer" }).ok).toBe(false);
  });
  it("a cash refund waits for a CLABE", () => {
    const { rt, kase } = reported(["mat"], "cash");
    kase({ type: "START_REVIEW" }); kase({ type: "DECIDE", decision: "refundCustomer" });
    rt.advanceHours(24 * 15);
    expect(rt.refunds[0]).toMatchObject({ amount: 1400, destination: "clabe" });
    expect(rt.provideClabe(rt.refunds[0]!.id, "012345678901234567")).toBe(true);
  });
});

describe("approved additional work can be reported like any other line (G6)", () => {
  it("is a selectable line with its own amount", () => {
    const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
    rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
    const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error(r.error); };
    for (const e of [{ type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }, { type: "SELECT_PROFESSIONAL", professionalId: "p6" },
      { type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines: LINES },
      { type: "ACCEPT_QUOTE", method: "card", jobStart: addHours(t0, 30) }, { type: "PAYMENT_SATISFIED", amount: 840 }]) go(e);
    rt.advanceHours(30);
    for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK"]) go({ type: e });
    go({ type: "REQUEST_ADDITIONAL_WORK", amount: 500 }); go({ type: "APPROVE_ADDITIONAL_WORK" });
    for (const e of ["CHECKLIST_COMPLETE", "MARK_COMPLETE", "BALANCE_PAID"]) go({ type: e });
    go({ type: "REPORT_ISSUE", selected: ["additional"] });
    expect((rt.get("case:job")!.snap.ctx as { heldAmount: number }).heldAmount).toBe(500);
  });
});

describe("scenario 10: warranty claim", () => {
  it("after release the warranty runs; a claim is filed, reviewed and resolved; later it ends", () => {
    const { rt, kase } = reported(["mat"]);
    kase({ type: "START_REVIEW" }); kase({ type: "DECIDE", decision: "releaseProfessional" });
    rt.advanceHours(24 * 15);
    const w = () => rt.get("warranty:job")!.snap.state;
    expect(w()).toBe("running");
    expect(rt.dispatch("warranty:job", { type: "FILE_CLAIM" }).ok).toBe(true);
    expect(rt.dispatch("warranty:job", { type: "START_REVIEW" }).ok).toBe(true);
    expect(rt.dispatch("warranty:job", { type: "RESOLVE", outcome: "resolved" }).ok).toBe(true);
    expect(w()).toBe("running");
    rt.advanceHours(24 * 31);
    expect(w()).toBe("expired");
    expect(rt.dispatch("warranty:job", { type: "FILE_CLAIM" }).ok).toBe(false);
  });
});
