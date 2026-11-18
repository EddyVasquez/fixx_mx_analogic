import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Clock } from "../src/core/clock/clock";
import { config } from "../src/core/config/fixx.config";
import { addHours } from "../src/core/rules";
import { jobMachine, newJobCtx, type JobCtx } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { requestReschedule, acceptReschedule, declineReschedule, rescheduleStatus } from "../src/mocks/runtime/rescheduleActors";
import { ensureReference, confirmPayment } from "../src/mocks/runtime/paymentActors";

const t0 = new Date("2026-10-06T16:00:00Z");
const lines = (t: number) => [{ id: "prep", amount: t * 0.15 }, { id: "mat", amount: t * 0.35 }, { id: "work", amount: t * 0.5 }];
function make(method: "card" | "cash", hours = 72, total = 4200) {
  const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
  rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
  const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error((e as { type: string }).type + ": " + r.error); };
  const quote = (tot: number, pro: string) => { go({ type: "SELECT_PROFESSIONAL", professionalId: pro }); go({ type: "SEND_QUOTE", total: tot, travelFee: 150, payoutRatio: 0.8, lines: lines(tot) }); };
  for (const e of [{ type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }]) go(e);
  quote(total, "p6");
  go({ type: "ACCEPT_QUOTE", method, jobStart: addHours(t0, hours) });
  const ctx = () => rt.get("job")!.snap.ctx as JobCtx;
  go({ type: "PAYMENT_SATISFIED", amount: ctx().initialDue });
  return { rt, go, ctx, quote, state: () => rt.get("job")!.snap.state };
}
const up = (go: (e: object) => void) => { for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK"]) go({ type: e }); };

describe("scenario 3: additional work", () => {
  it("card: approved work is added to the total and charged with the balance", () => {
    const { rt, go, ctx, state } = make("card");
    rt.advanceHours(72); up(go);
    go({ type: "REQUEST_ADDITIONAL_WORK", amount: 500 });
    expect(state()).toBe("additionalWorkPending");
    go({ type: "APPROVE_ADDITIONAL_WORK" });
    expect(ctx().total).toBe(4700);
    go({ type: "CHECKLIST_COMPLETE" }); go({ type: "MARK_COMPLETE" }); go({ type: "BALANCE_PAID" });
    rt.advanceHours(config.completionCheck.autoReleaseHours);
    expect(state()).toBe("paymentReleased");
    expect(rt.payouts[0]?.amount).toBe(3760);
  });
  it("cash: the job cannot be completed until the additional reference is paid", () => {
    const { rt, go, ctx, state } = make("cash", 72);
    go({ type: "BALANCE_PAID" });
    rt.advanceHours(72); up(go);
    go({ type: "REQUEST_ADDITIONAL_WORK", amount: 500 });
    go({ type: "APPROVE_ADDITIONAL_WORK" });
    expect(ctx().additional?.blocks).toBe(true);
    ensureReference(rt, "job", "additional", "cash", 500, null);
    expect(rt.scheduler.list("pay:job:additional")).toHaveLength(0);
    go({ type: "CHECKLIST_COMPLETE" });
    expect(rt.dispatch("job", { type: "MARK_COMPLETE" }).ok).toBe(false);
    confirmPayment(rt, "job", "additional");
    go({ type: "ADDITIONAL_WORK_PAID" });
    go({ type: "MARK_COMPLETE" });
    expect(state()).toBe("issueWindow");
  });
});

describe("scenario 6: reschedule requests", () => {
  it("accepted: the new time applies and the 12-hour timer is gone", () => {
    const { rt, ctx } = make("card");
    expect(requestReschedule(rt, "job", addHours(t0, 120)).ok).toBe(true);
    expect(ctx().jobStart.getTime()).toBe(addHours(t0, 72).getTime()); // current time stays booked
    expect(rescheduleStatus(rt, "job").status).toBe("pending");
    rt.advanceHours(5);
    expect(acceptReschedule(rt, "job").ok).toBe(true);
    expect(ctx().jobStart.getTime()).toBe(addHours(t0, 120).getTime());
    expect(rescheduleStatus(rt, "job").status).toBe("accepted");
    expect(rt.scheduler.list("job").some((x) => x.event.type === "RESCHEDULE_EXPIRED")).toBe(false);
    rt.advanceHours(10);
    expect(rt.get("job")!.snap.state).toBe("scheduled");
  });
  it("declined: the customer keeps the time", () => {
    const { rt, ctx, state } = make("card");
    requestReschedule(rt, "job", addHours(t0, 120));
    expect(declineReschedule(rt, "job").ok).toBe(true);
    expect(ctx().jobStart.getTime()).toBe(addHours(t0, 72).getTime());
    expect(state()).toBe("scheduled");
    expect(requestReschedule(rt, "job", addHours(t0, 100)).ok).toBe(true); // a new request is allowed
  });
  it("unanswered for 12 hours: the request expires and the customer can choose a replacement", () => {
    const { rt, go, ctx, state } = make("card");
    requestReschedule(rt, "job", addHours(t0, 120));
    rt.advanceHours(12);
    expect(state()).toBe("rescheduleUnanswered");
    expect(rescheduleStatus(rt, "job").status).toBe("expired");
    expect(acceptReschedule(rt, "job").ok).toBe(false);
    go({ type: "CHOOSE_REPLACEMENT" });
    expect(state()).toBe("recommendations");
    expect(ctx().carryOver).toBe(840);
  });
  it("cannot be requested once the professional is on the way", () => {
    const { rt, go } = make("card");
    rt.advanceHours(72); go({ type: "ON_THE_WAY" });
    expect(requestReschedule(rt, "job", addHours(t0, 200)).ok).toBe(false);
  });
});

describe("scenario 7: customer cancels", () => {
  it("before on the way: free, full refund to the original method", () => {
    const { rt, go, state } = make("card");
    go({ type: "CUSTOMER_CANCELS" });
    expect(state()).toBe("cancelled");
    expect(rt.refunds[0]).toMatchObject({ amount: 840, destination: "original" });
  });
  it("after on the way: the travel fee goes to the professional", () => {
    const { rt, go, ctx } = make("card");
    rt.advanceHours(72); go({ type: "ON_THE_WAY" }); go({ type: "CUSTOMER_CANCELS" });
    expect(ctx().refund).toMatchObject({ refund: 690, travelFeeCharged: 150, toProfessional: 150 });
    expect(rt.refunds[0]?.amount).toBe(690);
  });
  it("zero-refund case: the travel fee equals the payment, so no refund is created", () => {
    const { rt, go, ctx } = make("card");
    rt.advanceHours(72); go({ type: "ON_THE_WAY" });
    rt.get("job")!.snap.ctx = { ...ctx(), paid: 150 };
    go({ type: "CUSTOMER_CANCELS" });
    expect(ctx().refund?.noRefund).toBe(true);
    expect(rt.refunds).toHaveLength(0);
  });
});

describe("scenario 8: professional cancels or does not show", () => {
  it("late cancellation lowers the score; replacement with a higher quote asks only for the difference", () => {
    const { rt, go, ctx, quote, state } = make("card");
    rt.advanceHours(72); go({ type: "ON_THE_WAY" }); go({ type: "PRO_CANCELS" });
    expect(rt.penalties[0]?.reason).toBe("lateCancellation");
    go({ type: "CHOOSE_REPLACEMENT" });
    quote(5000, "p2");
    go({ type: "ACCEPT_QUOTE", method: "card", jobStart: addHours(rt.clock.now(), 30) });
    expect(state()).toBe("awaitingDeposit");
    expect(ctx().initialDue - ctx().paid).toBe(160);
    go({ type: "PAYMENT_SATISFIED", amount: 160 });
    expect(state()).toBe("scheduled");
  });
  it("a cheaper replacement is covered by the carried-over payment", () => {
    const { rt, go, quote, state } = make("card");
    go({ type: "PRO_NO_SHOW" });
    expect(rt.penalties[0]?.reason).toBe("noShow");
    go({ type: "CHOOSE_REPLACEMENT" });
    quote(4000, "p5");
    go({ type: "ACCEPT_QUOTE", method: "card", jobStart: addHours(rt.clock.now(), 30) });
    expect(state()).toBe("scheduled");
  });
  it("or the customer takes a full refund", () => {
    const { rt, go, state } = make("card");
    go({ type: "PRO_CANCELS" });
    go({ type: "CHOOSE_REFUND" });
    expect(state()).toBe("refunded");
    expect(rt.refunds[0]).toMatchObject({ amount: 840, destination: "original" });
  });
});

describe("copy for the messages the reschedule helper sends", () => {
  it("exists in EN, ES and KO", () => {
    for (const lang of ["en", "es", "ko"]) {
      const d = JSON.parse(readFileSync(join(process.cwd(), `src/i18n/${lang}/branches.json`), "utf8")) as Record<string, unknown>;
      expect("notif.reschedule.requested" in d && "notif.reschedule.requestSent" in d).toBe(true);
    }
  });
  it("tells the professional and the customer when a request is made", () => {
    const { rt } = make("card");
    requestReschedule(rt, "job", addHours(t0, 120));
    const t = rt.center.list().map((r) => `${r.template}:${r.audience}`);
    expect(t).toContain("reschedule.requested:professional");
    expect(t).toContain("reschedule.requestSent:customer");
  });
});
