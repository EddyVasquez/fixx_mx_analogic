import { describe, it, expect } from "vitest";
import { addHours } from "../src/core/rules";
import {
  jobMachine, newJobCtx, createSnapshot, send, statusFor, cancelLowersQualityScore, allowedEvents, adminJobEvents,
  paymentMachine, rescheduleMachine, newReschedule, caseMachine, newCase, warrantyMachine, newWarranty,
  verificationMachine, newVerification, supportMachine, activeHandler,
  type JobEvent, type JobState, type JobCtx, type Snapshot, type Effect
} from "../src/core/machines";

const t0 = new Date("2026-10-06T16:00:00Z"); // Tuesday 10:00 in Monterrey
const at = (h: number) => addHours(t0, h);
type JS = Snapshot<JobState, JobCtx>;
const lines = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "paint", amount: 2200 }];

function run(snap: JS, ...events: [JobEvent, Date?][]): JS {
  let s = snap;
  for (const [e, when] of events) {
    const r = send(jobMachine, s, e, when ?? t0);
    if (!r.ok) throw new Error(`${e.type}: ${r.error}`);
    s = r.snapshot;
  }
  return s;
}
const effectsOf = (s: JS, e: JobEvent, when: Date = t0): Effect[] => {
  const r = send(jobMachine, s, e, when);
  if (!r.ok) throw new Error(r.error);
  return r.effects;
};
const hasEffect = (fx: Effect[], type: Effect["type"]) => fx.some((f) => f.type === type);

const quoteSent = (): JS => run(createSnapshot(jobMachine, newJobCtx()),
  [{ type: "ESTIMATE_READY" }], [{ type: "RECOMMENDATIONS_READY" }],
  [{ type: "SELECT_PROFESSIONAL", professionalId: "p2" }],
  [{ type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines }]);
const accepted = (method: "card" | "cash", hours: number): JS =>
  run(quoteSent(), [{ type: "ACCEPT_QUOTE", method, jobStart: at(hours) }]);
const scheduled = (method: "card" | "cash" = "card", hours = 72): JS => {
  const a = accepted(method, hours);
  return run(a, [{ type: "PAYMENT_SATISFIED", amount: a.ctx.initialDue }]);
};
const working = (method: "card" | "cash" = "card"): JS =>
  run(scheduled(method), [{ type: "ON_THE_WAY", }, at(72)], [{ type: "CHECK_IN" }], [{ type: "START_WORK" }]);
const issueWindow = (): JS =>
  run(working(), [{ type: "CHECKLIST_COMPLETE" }], [{ type: "MARK_COMPLETE" }, at(75)], [{ type: "BALANCE_PAID" }, at(75)]);

describe("job: happy path with a card (scenario 1)", () => {
  it("walks from request to rated, with the status bar mapping at each step", () => {
    let s = createSnapshot(jobMachine, newJobCtx());
    expect(statusFor(s.state)).toBe("requestSubmitted");
    s = quoteSent();
    expect(statusFor(s.state)).toBe("quoteSent");
    s = scheduled("card", 72);
    expect(s.state).toBe("scheduled");
    expect(s.ctx.paid).toBe(840);
    s = working();
    expect(statusFor(s.state)).toBe("inProgress");
    s = run(s, [{ type: "CHECKLIST_COMPLETE" }], [{ type: "MARK_COMPLETE" }, at(75)]);
    expect(s.state).toBe("markedComplete");
    s = run(s, [{ type: "BALANCE_PAID" }, at(75)]);
    expect(s.state).toBe("issueWindow");
    expect(s.ctx.issueWindowEndsAt?.getTime()).toBe(at(99).getTime());
    const fx = effectsOf(s, { type: "WINDOW_CLOSED" }, at(99));
    expect(hasEffect(fx, "releasePayout")).toBe(true);
    expect(hasEffect(fx, "startWarranty")).toBe(true);
    s = run(s, [{ type: "WINDOW_CLOSED" }, at(99)], [{ type: "RATE" }, at(100)]);
    expect(s.state).toBe("rated");
    expect(s.history.length).toBeGreaterThan(10);
  });
  it("rejects events that do not belong to the current state", () => {
    const s = createSnapshot(jobMachine, newJobCtx());
    const r = send(jobMachine, s, { type: "ACCEPT_QUOTE", method: "card", jobStart: at(5) }, t0);
    expect(r.ok).toBe(false);
    expect(r.snapshot.state).toBe("submitted");
    expect(allowedEvents(jobMachine, "submitted")).toContain("ESTIMATE_READY");
  });
  it("only schedules timers for events the machine handles", () => {
    const known = new Set(Object.values(jobMachine.on).flatMap((t) => Object.keys(t ?? {})));
    const all = [
      ...effectsOf(quoteSent(), { type: "ACCEPT_QUOTE", method: "cash", jobStart: at(72) }),
      ...effectsOf(working(), { type: "CHECKLIST_COMPLETE" }),
      ...effectsOf(run(working(), [{ type: "CHECKLIST_COMPLETE" }], [{ type: "MARK_COMPLETE" }, at(75)]), { type: "BALANCE_PAID" }, at(75))
    ];
    const timers = all.filter((f): f is Extract<Effect, { type: "timer" }> => f.type === "timer");
    expect(timers.length).toBeGreaterThan(0);
    timers.forEach((tm) => expect(known.has(tm.event.type)).toBe(true));
  });
});

describe("job: cash/SPEI deadlines (scenarios 2 and 4)", () => {
  it("far: deposit timer at +24h, balance timer 24h before the job", () => {
    const fx = effectsOf(quoteSent(), { type: "ACCEPT_QUOTE", method: "cash", jobStart: at(72) });
    const timers = fx.filter((f): f is Extract<Effect, { type: "timer" }> => f.type === "timer");
    expect(timers.find((x) => x.event.type === "BOOKING_EXPIRED")?.at.getTime()).toBe(at(24).getTime());
    expect(timers.find((x) => x.event.type === "BALANCE_OVERDUE")?.at.getTime()).toBe(at(48).getTime());
  });
  it("unpaid deposit expires the booking", () => {
    const s = run(accepted("cash", 72), [{ type: "BOOKING_EXPIRED" }, at(24)]);
    expect(s.state).toBe("bookingExpired");
  });
  it("a partial payment keeps waiting; the full deposit schedules the job", () => {
    const a = accepted("cash", 72);
    const p = run(a, [{ type: "PAYMENT_SATISFIED", amount: 400 }]);
    expect(p.state).toBe("awaitingDeposit");
    expect(run(p, [{ type: "PAYMENT_SATISFIED", amount: 440 }]).state).toBe("scheduled");
  });
  it("unpaid balance cancels the job and refunds the deposit to a CLABE", () => {
    const fx = effectsOf(scheduled("cash", 72), { type: "BALANCE_OVERDUE" }, at(48));
    expect(fx).toContainEqual({ type: "createRefund", amount: 840, destination: "clabe" });
    expect(run(scheduled("cash", 72), [{ type: "BALANCE_OVERDUE" }, at(48)]).state).toBe("cancelled");
  });
  it("within 24h the full amount is due in 3 hours", () => {
    const a = accepted("cash", 10);
    expect(a.ctx.initialDue).toBe(4200);
    const fx = effectsOf(quoteSent(), { type: "ACCEPT_QUOTE", method: "cash", jobStart: at(10) });
    expect(fx.find((f) => f.type === "timer" && f.at.getTime() === at(3).getTime())).toBeTruthy();
  });
  it("a balance paid early skips the balance-due step on completion", () => {
    const s = run(scheduled("cash", 72), [{ type: "BALANCE_PAID" }], [{ type: "ON_THE_WAY" }, at(72)], [{ type: "CHECK_IN" }], [{ type: "START_WORK" }],
      [{ type: "CHECKLIST_COMPLETE" }], [{ type: "MARK_COMPLETE" }, at(75)]);
    expect(s.state).toBe("issueWindow");
  });
});

describe("job: additional work (scenario 3)", () => {
  it("card: added to the total and does not block completion", () => {
    const s = run(working("card"), [{ type: "REQUEST_ADDITIONAL_WORK", amount: 500 }], [{ type: "APPROVE_ADDITIONAL_WORK" }],
      [{ type: "CHECKLIST_COMPLETE" }], [{ type: "MARK_COMPLETE" }, at(75)]);
    expect(s.ctx.total).toBe(4700);
    expect(s.state).toBe("markedComplete");
  });
  it("cash: completion is blocked until the reference is paid", () => {
    const s = run(working("cash"), [{ type: "REQUEST_ADDITIONAL_WORK", amount: 500 }], [{ type: "APPROVE_ADDITIONAL_WORK" }], [{ type: "CHECKLIST_COMPLETE" }]);
    const blocked = send(jobMachine, s, { type: "MARK_COMPLETE" }, at(75));
    expect(blocked.ok).toBe(false);
    expect(run(s, [{ type: "ADDITIONAL_WORK_PAID" }], [{ type: "MARK_COMPLETE" }, at(75)]).state).toBe("markedComplete");
  });
  it("a declined request changes nothing about the price", () => {
    const s = run(working("card"), [{ type: "REQUEST_ADDITIONAL_WORK", amount: 500 }], [{ type: "DECLINE_ADDITIONAL_WORK" }]);
    expect(s.state).toBe("inProgress");
    expect(s.ctx.total).toBe(4200);
  });
  it("cannot complete before the checklist", () => {
    expect(send(jobMachine, working(), { type: "MARK_COMPLETE" }, at(75)).ok).toBe(false);
  });
});

describe("job: reschedule (scenario 6)", () => {
  it("accepted: new time, payments recalculated", () => {
    const s = scheduled("cash", 72);
    const fx = effectsOf(s, { type: "RESCHEDULE_ACCEPTED", newStart: at(120) });
    expect(hasEffect(fx, "recalculatePayments")).toBe(true);
    expect(run(s, [{ type: "RESCHEDULE_ACCEPTED", newStart: at(120) }]).ctx.jobStart.getTime()).toBe(at(120).getTime());
  });
  it("declined: the customer keeps the current time", () => {
    const s = run(scheduled(), [{ type: "RESCHEDULE_DECLINED" }]);
    expect(s.state).toBe("scheduled");
    expect(s.ctx.jobStart.getTime()).toBe(at(72).getTime());
  });
  it("unanswered: the customer can pick another professional at no cost, or get a refund", () => {
    const u = run(scheduled(), [{ type: "RESCHEDULE_EXPIRED" }]);
    expect(u.state).toBe("rescheduleUnanswered");
    const r = run(u, [{ type: "CHOOSE_REPLACEMENT" }]);
    expect(r.state).toBe("recommendations");
    expect(r.ctx.carryOver).toBe(840);
    expect(effectsOf(u, { type: "CHOOSE_REFUND" })).toContainEqual({ type: "createRefund", amount: 840, destination: "original" });
  });
  it("the reschedule request itself: 12-hour window", () => {
    const base = { ctx: newReschedule(t0, at(100)), state: "pending" as const, history: [] };
    expect(send(rescheduleMachine, base, { type: "ACCEPT" }, at(11)).ok).toBe(true);
    expect(send(rescheduleMachine, base, { type: "EXPIRE" }, at(11)).ok).toBe(false);
    expect(send(rescheduleMachine, base, { type: "EXPIRE" }, at(12)).ok).toBe(true);
    expect(send(rescheduleMachine, base, { type: "ACCEPT" }, at(12)).ok).toBe(false);
    expect(send(rescheduleMachine, base, { type: "DECLINE" }, at(5)).ok).toBe(true);
  });
});

describe("job: cancellations (scenarios 7 and 8)", () => {
  it("customer cancels before on the way: free, full refund", () => {
    const fx = effectsOf(scheduled(), { type: "CUSTOMER_CANCELS" });
    expect(fx).toContainEqual({ type: "createRefund", amount: 840, destination: "original" });
    const s = run(scheduled(), [{ type: "CUSTOMER_CANCELS" }], [{ type: "REFUND_ISSUED" }]);
    expect(s.state).toBe("refunded");
  });
  it("customer cancels after on the way: refund minus the travel fee", () => {
    const s = run(scheduled(), [{ type: "ON_THE_WAY" }, at(72)], [{ type: "CUSTOMER_CANCELS" }, at(72)]);
    expect(s.ctx.refund).toMatchObject({ refund: 690, travelFeeCharged: 150, toProfessional: 150 });
  });
  it("travel fee equal to the payment: no refund is created", () => {
    const base = run(scheduled(), [{ type: "ON_THE_WAY" }, at(72)]);
    const poor: JS = { ...base, ctx: { ...base.ctx, paid: 150 } };
    const fx = effectsOf(poor, { type: "CUSTOMER_CANCELS" }, at(72));
    expect(hasEffect(fx, "createRefund")).toBe(false);
    expect(run(poor, [{ type: "CUSTOMER_CANCELS" }, at(72)]).ctx.refund?.noRefund).toBe(true);
  });
  it("professional cancels early: no penalty; after on the way: penalty", () => {
    expect(hasEffect(effectsOf(scheduled(), { type: "PRO_CANCELS" }), "qualityPenalty")).toBe(false);
    const late = run(scheduled(), [{ type: "ON_THE_WAY" }, at(72)]);
    expect(hasEffect(effectsOf(late, { type: "PRO_CANCELS" }, at(72)), "qualityPenalty")).toBe(true);
    expect(cancelLowersQualityScore("onTheWay")).toBe(true);
    expect(cancelLowersQualityScore("scheduled")).toBe(false);
  });
  it("no-show lowers the score and the customer chooses a replacement or a refund", () => {
    const s = scheduled();
    expect(hasEffect(effectsOf(s, { type: "PRO_NO_SHOW" }, at(73)), "qualityPenalty")).toBe(true);
    const n = run(s, [{ type: "PRO_NO_SHOW" }, at(73)]);
    expect(n.state).toBe("noShow");
    expect(run(n, [{ type: "CHOOSE_REPLACEMENT" }]).state).toBe("recommendations");
    expect(run(n, [{ type: "CHOOSE_REFUND" }]).state).toBe("refunded");
  });
  it("once checked in, professional cancellation is not self-service (decision G3)", () => {
    expect(send(jobMachine, working(), { type: "PRO_CANCELS" }, at(73)).ok).toBe(false);
  });
});

describe("job: issue reports (scenario 9)", () => {
  it("selected items hold their cost; the professional sees the net share", () => {
    const s = run(issueWindow(), [{ type: "REPORT_ISSUE", selected: ["mat"] }, at(76)]);
    expect(s.state).toBe("issueOpen");
    expect(s.ctx.heldAmount).toBe(1400);
    expect(s.ctx.heldPayout).toBe(1120);
    expect(run(s, [{ type: "CASE_RESOLVED" }, at(120)]).state).toBe("paymentReleased");
  });
  it("the whole job holds the full amount", () => {
    expect(run(issueWindow(), [{ type: "REPORT_ISSUE", selected: "wholeJob" }, at(76)]).ctx.heldAmount).toBe(4200);
  });
  it("a report after the window closes is refused; closing early is refused", () => {
    expect(send(jobMachine, issueWindow(), { type: "REPORT_ISSUE", selected: "wholeJob" }, at(100)).ok).toBe(false);
    expect(send(jobMachine, issueWindow(), { type: "WINDOW_CLOSED" }, at(80)).ok).toBe(false);
  });
  it("sends the 6-hour reminder", () => {
    expect(hasEffect(effectsOf(issueWindow(), { type: "ISSUE_REMINDER" }, at(93)), "notify")).toBe(true);
  });
});

describe("job: regulated work stays pending until an admin approves", () => {
  it("refuses booking and leaves only through the admin approve action", () => {
    let s = run(createSnapshot(jobMachine, newJobCtx({ needsReview: true })),
      [{ type: "ESTIMATE_READY" }], [{ type: "RECOMMENDATIONS_READY" }],
      [{ type: "SELECT_PROFESSIONAL", professionalId: "p2" }]);
    const fx = effectsOf(s, { type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines });
    expect(fx.some((f) => f.type === "notify" && f.template === "quote.pendingReview" && f.audience.includes("admin"))).toBe(true);
    s = run(s, [{ type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines }]);
    expect(s.state).toBe("pendingReview");
    expect(statusFor(s.state)).toBeNull();
    expect(allowedEvents(jobMachine, "pendingReview")).toEqual(["PENDING_REVIEW_APPROVED"]);
    expect(adminJobEvents).toContain("PENDING_REVIEW_APPROVED");
    const blocked = send(jobMachine, s, { type: "ACCEPT_QUOTE", method: "card", jobStart: at(72) }, t0);
    expect(blocked.ok).toBe(false);
    expect(blocked.snapshot.state).toBe("pendingReview");
    expect(run(s, [{ type: "PENDING_REVIEW_APPROVED" }]).state).toBe("quoteSent");
  });
});

describe("job: out-of-area manual review (scenario 5)", () => {
  it("goes to manual review and notifies Admin", () => {
    const s = createSnapshot(jobMachine, newJobCtx());
    const fx = effectsOf(s, { type: "OUT_OF_AREA" });
    expect(fx.some((f) => f.type === "notify" && f.audience.includes("admin"))).toBe(true);
    expect(run(s, [{ type: "OUT_OF_AREA" }], [{ type: "MANUAL_REVIEW_APPROVED" }]).state).toBe("estimated");
  });
});

describe("case, warranty, verification, payment, support machines", () => {
  const cs = () => ({ ...createSnapshot(caseMachine, newCase(t0, 1400, 1120)) });
  it("case: SLA is 5 business days; each party gets one review", () => {
    expect(cs().ctx.resolveBy.toISOString()).toBe("2026-10-13T16:00:00.000Z");
    const step = <E extends Parameters<typeof send<any, any, any>>[2]>(s: any, e: E, when = t0) => {
      const r = send(caseMachine, s, e as never, when); if (!r.ok) throw new Error(r.error); return r.snapshot;
    };
    let s = step(cs(), { type: "START_REVIEW" });
    s = step(s, { type: "DECIDE", decision: "partial refund" }, at(24));
    expect(s.ctx.reviewBy?.getTime()).toBe(at(24).getTime() + 14 * 86_400_000);
    s = step(s, { type: "REQUEST_REVIEW", by: "customer" }, at(30));
    s = step(s, { type: "REVIEW_DECIDED", decision: "same" }, at(40));
    expect(s.state).toBe("decided");
    expect(send(caseMachine, s, { type: "REQUEST_REVIEW", by: "customer" }, at(50)).ok).toBe(false);
    s = step(s, { type: "REQUEST_REVIEW", by: "professional" }, at(50));
    s = step(s, { type: "REVIEW_DECIDED", decision: "final" }, at(60));
    expect(s.state).toBe("final");
  });
  it("case: becomes final when the review deadline passes", () => {
    const s0: any = { ...cs(), state: "decided", ctx: { ...cs().ctx, reviewBy: at(24 * 14) } };
    expect(send(caseMachine, s0, { type: "DEADLINE_PASSED" }, at(24 * 13)).ok).toBe(false);
    expect(send(caseMachine, s0, { type: "REQUEST_REVIEW", by: "customer" }, at(24 * 15)).ok).toBe(false);
    expect(send(caseMachine, s0, { type: "DEADLINE_PASSED" }, at(24 * 15)).ok).toBe(true);
  });
  it("warranty: length from config, claims only while it runs (scenario 10)", () => {
    const w = createSnapshot(warrantyMachine, newWarranty(t0, "painting"));
    expect(w.ctx.endsAt.getTime()).toBe(t0.getTime() + 30 * 86_400_000);
    const f = send(warrantyMachine, w, { type: "FILE_CLAIM" }, at(24 * 5));
    expect(f.ok).toBe(true);
    if (f.ok) {
      const r1 = send(warrantyMachine, f.snapshot, { type: "START_REVIEW" }, at(24 * 6));
      const r2 = r1.ok ? send(warrantyMachine, r1.snapshot, { type: "RESOLVE", outcome: "resolved" }, at(24 * 7)) : r1;
      expect(r2.ok && r2.snapshot.state).toBe("running");
    }
    expect(send(warrantyMachine, w, { type: "FILE_CLAIM" }, at(24 * 31)).ok).toBe(false);
    expect(send(warrantyMachine, w, { type: "EXPIRE" }, at(24 * 10)).ok).toBe(false);
    expect(send(warrantyMachine, w, { type: "EXPIRE" }, at(24 * 31)).ok).toBe(true);
  });
  it("verification: ID + selfie + phone, rejection reason, number recovery (scenario 11)", () => {
    const v0 = createSnapshot(verificationMachine, newVerification());
    expect(send(verificationMachine, v0, { type: "SUBMIT", idDoc: true, selfie: false, phoneVerified: true }, t0).ok).toBe(false);
    const sub = send(verificationMachine, v0, { type: "SUBMIT", idDoc: true, selfie: true, phoneVerified: true }, t0);
    expect(sub.ok && sub.snapshot.state).toBe("pending");
    if (!sub.ok) return;
    expect(send(verificationMachine, sub.snapshot, { type: "REJECT", reason: "  " }, t0).ok).toBe(false);
    const ok = send(verificationMachine, sub.snapshot, { type: "APPROVE" }, t0);
    if (!ok.ok) throw new Error(ok.error);
    const lost = send(verificationMachine, ok.snapshot, { type: "REPORT_LOST_NUMBER" }, t0);
    if (!lost.ok) throw new Error(lost.error);
    expect(lost.snapshot.state).toBe("recovery");
    expect(send(verificationMachine, lost.snapshot, { type: "SUBMIT_RECOVERY", selfie: true, newPhoneVerified: false }, t0).ok).toBe(false);
    const re = send(verificationMachine, lost.snapshot, { type: "SUBMIT_RECOVERY", selfie: true, newPhoneVerified: true }, t0);
    if (!re.ok) throw new Error(re.error);
    const back = send(verificationMachine, re.snapshot, { type: "APPROVE" }, t0);
    expect(back.ok && back.snapshot.state).toBe("approved");
    expect(back.ok && back.snapshot.ctx.recovery).toBe(false);
  });
  it("payment: cash reference, expiry, confirmation, refund", () => {
    const ctx = { kind: "deposit" as const, method: "cash" as const, amount: 840, dueAt: at(24), reference: null };
    const p0 = createSnapshot(paymentMachine, ctx);
    const w = send(paymentMachine, p0, { type: "CREATE_REFERENCE", reference: "DEMO-0001" }, t0);
    if (!w.ok) throw new Error(w.error);
    expect(send(paymentMachine, w.snapshot, { type: "DEADLINE_PASSED" }, at(23)).ok).toBe(false);
    expect(send(paymentMachine, w.snapshot, { type: "DEADLINE_PASSED" }, at(24)).ok).toBe(true);
    const got = send(paymentMachine, w.snapshot, { type: "PAYMENT_CONFIRMED" }, at(10));
    if (!got.ok) throw new Error(got.error);
    expect(send(paymentMachine, got.snapshot, { type: "REFUND_ISSUED" }, at(11)).ok).toBe(true);
    const card = createSnapshot(paymentMachine, { ...ctx, method: "card" as const });
    expect(send(paymentMachine, card, { type: "CREATE_REFERENCE", reference: "x" }, t0).ok).toBe(false);
    expect(send(paymentMachine, card, { type: "CARD_CHARGED" }, t0).ok).toBe(true);
  });
  it("support: Agent hours vs. the Assistant, always labelled", () => {
    const s0 = createSnapshot(supportMachine, { language: "ko" as const, isEmergency: false });
    expect(activeHandler(s0.state)).toBe("assistant");
    const day = send(supportMachine, s0, { type: "REQUEST_AGENT" }, t0);
    expect(day.ok && day.snapshot.state).toBe("agentQueue");
    const night = send(supportMachine, s0, { type: "REQUEST_AGENT" }, new Date("2026-10-07T03:00:00Z"));
    expect(night.ok && night.snapshot.state).toBe("offline");
    const sunday = send(supportMachine, s0, { type: "REQUEST_AGENT" }, new Date("2026-10-11T18:00:00Z"));
    expect(sunday.ok && sunday.snapshot.state).toBe("offline");
    if (day.ok) {
      const j = send(supportMachine, day.snapshot, { type: "AGENT_JOINS" }, t0);
      expect(j.ok && activeHandler(j.snapshot.state)).toBe("agent");
    }
  });
});
