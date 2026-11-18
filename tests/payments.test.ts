import { describe, it, expect } from "vitest";
import { Clock } from "../src/core/clock/clock";
import { addHours, buildSchedule } from "../src/core/rules";
import { jobMachine, newJobCtx, type JobCtx } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { ensureReference, confirmPayment, paymentState } from "../src/mocks/runtime/paymentActors";

const t0 = new Date("2026-10-06T16:00:00Z");
const LINES = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "work", amount: 2200 }];
function cashJob(method: "cash" | "spei", hoursAway: number) {
  const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
  rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
  const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error(r.error); };
  for (const e of [{ type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }, { type: "SELECT_PROFESSIONAL", professionalId: "p6" },
    { type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines: LINES },
    { type: "ACCEPT_QUOTE", method, jobStart: addHours(t0, hoursAway) }]) go(e);
  const ctx = () => rt.get("job")!.snap.ctx as JobCtx;
  const sch = () => buildSchedule({ method, total: ctx().total, jobStart: ctx().jobStart, now: ctx().scheduleBasis! });
  return { rt, go, ctx, sch, state: () => rt.get("job")!.snap.state };
}
const work = (go: (e: object) => void) => { for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK", "CHECKLIST_COMPLETE", "MARK_COMPLETE"]) go({ type: e }); };

describe("scenario 2: cash/SPEI with deadlines, expiry and balance before start", () => {
  it("unpaid deposit: the reference expires and the booking expires, with a message each", () => {
    const { rt, sch, state } = cashJob("cash", 72);
    const dep = sch().installments[0]!;
    ensureReference(rt, "job", "deposit", "cash", dep.amount, dep.dueAt!);
    expect(paymentState(rt, "job", "deposit")).toBe("waitingReference");
    expect(rt.center.list().some((r) => r.template === "payment.referenceCreated" && r.audience === "customer")).toBe(true);
    rt.advanceHours(25);
    expect(paymentState(rt, "job", "deposit")).toBe("expired");
    expect(state()).toBe("bookingExpired");
    expect(rt.center.list().some((r) => r.template === "payment.expired")).toBe(true);
  });
  it("deposit paid, then the balance before the job: the job runs to the issue window", () => {
    const { rt, go, sch, state } = cashJob("spei", 72);
    const [dep, bal] = sch().installments;
    ensureReference(rt, "job", "deposit", "spei", dep!.amount, dep!.dueAt!);
    confirmPayment(rt, "job", "deposit");
    go({ type: "PAYMENT_SATISFIED", amount: dep!.amount });
    expect(state()).toBe("scheduled");
    ensureReference(rt, "job", "balance", "spei", bal!.amount, bal!.dueAt!);
    rt.advanceHours(30);
    confirmPayment(rt, "job", "balance");
    go({ type: "BALANCE_PAID" });
    rt.advanceHours(42);
    work(go);
    expect(state()).toBe("issueWindow");
  });
  it("balance not paid in time: the job is cancelled and the refund waits for a CLABE", () => {
    const { rt, go, sch, state } = cashJob("cash", 72);
    const dep = sch().installments[0]!;
    go({ type: "PAYMENT_SATISFIED", amount: dep.amount });
    rt.advanceHours(49);
    expect(state()).toBe("cancelled");
    const refund = rt.refunds[0]!;
    expect(refund).toMatchObject({ amount: 840, destination: "clabe" });
    expect(rt.provideClabe(refund.id, "1234")).toBe(false);
    expect(rt.provideClabe(refund.id, "0123 4567 8901 2345 67")).toBe(true);
    expect(rt.refunds[0]?.clabe).toBe("012345678901234567");
    go({ type: "REFUND_ISSUED" });
    expect(state()).toBe("refunded");
  });
  it("a reschedule drops the old references so they are re-created from the new deadlines", () => {
    const { rt, go, sch } = cashJob("cash", 72);
    const dep = sch().installments[0]!;
    go({ type: "PAYMENT_SATISFIED", amount: dep.amount });
    const bal = sch().installments[1]!;
    ensureReference(rt, "job", "balance", "cash", bal.amount, bal.dueAt!);
    go({ type: "RESCHEDULE_ACCEPTED", newStart: addHours(t0, 120) });
    expect(rt.get("pay:job:balance")).toBe(undefined);
    expect(sch().installments[1]!.dueAt!.getTime()).toBe(addHours(t0, 96).getTime());
  });
});

describe("scenario 4: urgent job, full amount within 3 hours", () => {
  it("unpaid: the request expires after 3 hours", () => {
    const { rt, sch, state } = cashJob("cash", 4);
    expect(sch().tier).toBe("near");
    const full = sch().installments[0]!;
    expect(full).toMatchObject({ kind: "full", amount: 4200 });
    ensureReference(rt, "job", "full", "cash", full.amount, full.dueAt!);
    rt.advanceHours(2); expect(state()).toBe("awaitingDeposit");
    rt.advanceHours(2); expect(state()).toBe("bookingExpired");
  });
  it("paid in full: nothing is left to charge when the job is marked complete", () => {
    const { rt, go, ctx, sch, state } = cashJob("spei", 4);
    const full = sch().installments[0]!;
    ensureReference(rt, "job", "full", "spei", full.amount, full.dueAt!);
    confirmPayment(rt, "job", "full");
    go({ type: "PAYMENT_SATISFIED", amount: full.amount });
    expect(ctx().balancePaid).toBe(true);
    rt.advanceHours(4);
    work(go);
    expect(state()).toBe("issueWindow");
  });
});
