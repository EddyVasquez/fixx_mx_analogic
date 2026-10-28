import { describe, it, expect } from "vitest";
import { config } from "../src/core/config/fixx.config";
import { addHours, completionItems, completionWindow, customerBalance, customerDeposit } from "../src/core/rules";
import {
  jobMachine, newJobCtx, createSnapshot, send, allowedEvents,
  type JobEvent, type JobState, type JobCtx, type Snapshot, type Effect
} from "../src/core/machines";
import { createPhotoQueue } from "../src/features/shared/photoQueue";

const t0 = new Date("2026-10-06T16:00:00Z");
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

const ready = (): JS => {
  const quoted = run(createSnapshot(jobMachine, newJobCtx()),
    [{ type: "ESTIMATE_READY" }], [{ type: "RECOMMENDATIONS_READY" }],
    [{ type: "SELECT_PROFESSIONAL", professionalId: "p2" }],
    [{ type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines }]);
  const accepted = run(quoted, [{ type: "ACCEPT_QUOTE", method: "card", jobStart: at(72) }]);
  const scheduled = run(accepted, [{ type: "PAYMENT_SATISFIED", amount: accepted.ctx.initialDue }]);
  return run(scheduled,
    [{ type: "ON_THE_WAY" }, at(72)], [{ type: "CHECK_IN" }, at(72)], [{ type: "START_WORK" }, at(72)],
    [{ type: "CHECKLIST_COMPLETE" }, at(75)], [{ type: "MARK_COMPLETE" }, at(75)], [{ type: "BALANCE_PAID" }, at(75)]);
};

describe("completion check config", () => {
  it("keeps the 20% deposit and 80% balance, with labelled reminder and release times", () => {
    expect(config.deposit.sharePct).toBe(20);
    expect(customerDeposit(4200)).toBe(840);
    expect(customerBalance(4200)).toBe(3360);
    expect(config.completionCheck.autoReleaseHours).toBe(48);
    expect(config.completionCheck.reminders.map((r) => r.hours)).toEqual([2, 24, 44]);
    expect(config.completionCheck.reminders.map((r) => r.label)).toEqual(["first reminder", "second reminder", "last reminder"]);
    expect(config.completionCheck.autoReleaseLabel).toBe("balance auto-release");
    expect(config.completionCheck.returnVisitHours).toBe(72);
    const w = completionWindow(at(75));
    expect(w.endsAt.getTime()).toBe(at(75 + 48).getTime());
    expect(w.reminders.map((r) => r.at.getTime())).toEqual([at(77).getTime(), at(99).getTime(), at(119).getTime()]);
  });
  it("gives every trade a short list on top of the shared core", () => {
    const core = config.completionCheck.coreItems;
    expect(core).toEqual(["asQuoted", "areaClean", "noDamage"]);
    for (const [trade, items] of Object.entries(config.completionCheck.tradeItems)) {
      expect(items.length, trade).toBeGreaterThanOrEqual(2);
      expect(items.length, trade).toBeLessThanOrEqual(3);
    }
    const plumbing = completionItems("plumbing").map((i) => i.id);
    expect(plumbing).toContain("plumbing.noLeaks");
    expect(completionItems("hvac").map((i) => i.id)).toContain("hvac.drainFlows");
    expect(completionItems("electrical").map((i) => i.id)).toContain("electrical.outletsWork");
    expect(completionItems("pest_control").map((i) => i.id)).toContain("pest_control.certificate");
  });
});

describe("completion check transitions", () => {
  it("approve releases the balance immediately", () => {
    const s = ready();
    expect(s.state).toBe("issueWindow");
    const fx = effectsOf(s, { type: "APPROVE_COMPLETION" }, at(76));
    expect(fx.some((f) => f.type === "releasePayout")).toBe(true);
    expect(fx.some((f) => f.type === "startWarranty")).toBe(true);
    expect(fx.some((f) => f.type === "notify" && f.template === "completion.approved")).toBe(true);
    expect(run(s, [{ type: "APPROVE_COMPLETION" }, at(76)]).state).toBe("paymentReleased");
  });
  it("auto-releases only when the window has ended, and refuses a late approve or report", () => {
    const window = ready();
    expect(effectsOf(window, { type: "ISSUE_REMINDER" }, at(77)).some((f) => f.type === "notify" && f.template === "issueWindow.reminder")).toBe(true);
    expect(send(jobMachine, window, { type: "WINDOW_CLOSED" }, at(75 + 47)).ok).toBe(false);
    expect(run(window, [{ type: "WINDOW_CLOSED" }, at(75 + 48)]).state).toBe("paymentReleased");
    expect(send(jobMachine, window, { type: "APPROVE_COMPLETION" }, at(75 + 49)).ok).toBe(false);
    expect(send(jobMachine, window, { type: "REPORT_ISSUE", selected: "wholeJob" }, at(75 + 49)).ok).toBe(false);
  });
  it("arms a timer for each labelled reminder and for the auto-release", () => {
    let s = createSnapshot(jobMachine, newJobCtx());
    s = run(s,
      [{ type: "ESTIMATE_READY" }], [{ type: "RECOMMENDATIONS_READY" }],
      [{ type: "SELECT_PROFESSIONAL", professionalId: "p2" }],
      [{ type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines }]);
    s = run(s, [{ type: "ACCEPT_QUOTE", method: "card", jobStart: at(72) }]);
    s = run(s, [{ type: "PAYMENT_SATISFIED", amount: s.ctx.initialDue }]);
    s = run(s, [{ type: "ON_THE_WAY" }, at(72)], [{ type: "CHECK_IN" }], [{ type: "START_WORK" }], [{ type: "CHECKLIST_COMPLETE" }]);
    const fx = effectsOf(s, { type: "MARK_COMPLETE" }, at(75));
    // Card jobs wait for the balance before the window opens.
    expect(fx.some((f) => f.type === "timer")).toBe(false);
    const opened = effectsOf(run(s, [{ type: "MARK_COMPLETE" }, at(75)]), { type: "BALANCE_PAID" }, at(75));
    const timers = opened.filter((f): f is Extract<Effect, { type: "timer" }> => f.type === "timer");
    expect(timers.map((t) => t.label)).toEqual(["first reminder", "second reminder", "last reminder", "balance auto-release"]);
    expect(timers.map((t) => t.at.getTime())).toEqual([at(77).getTime(), at(99).getTime(), at(119).getTime(), at(123).getTime()]);
    expect(timers.every((t) => t.event.type === "ISSUE_REMINDER" || t.event.type === "WINDOW_CLOSED")).toBe(true);
  });
  it("holds only the disputed amount and releases the rest", () => {
    const s = ready();
    const fx = effectsOf(s, { type: "REPORT_ISSUE", selected: ["mat"], category: "quality", description: "The paint bubbled", photoCount: 1 }, at(76));
    expect(fx.some((f) => f.type === "releasePayout" && f.amount === 2240)).toBe(true);
    expect(fx.some((f) => f.type === "notify" && f.template === "completion.partialRelease" && f.audience.includes("professional") && f.params["releasedPayout"] === 2240)).toBe(true);
    expect(fx.some((f) => f.type === "notify" && f.audience.includes("professional") && "amount" in (f.type === "notify" ? f.params : {}))).toBe(false);
    const next = run(s, [{ type: "REPORT_ISSUE", selected: ["mat"], category: "quality", description: "The paint bubbled", photoCount: 1 }, at(76)]);
    expect(next.state).toBe("issueOpen");
    expect(next.ctx.heldAmount).toBe(1400);
    expect(next.ctx.heldPayout).toBe(1120);
    expect(next.ctx.releasedAmount).toBe(2800);
    expect(next.ctx.releasedPayout).toBe(2240);
    expect(next.ctx.problemCategory).toBe("quality");
    expect(next.ctx.returnVisitBy?.getTime()).toBe(at(76 + config.completionCheck.returnVisitHours).getTime());
    expect(next.ctx.returnScheduled).toBe(false);
    const booked = run(next, [{ type: "SCHEDULE_RETURN" }, at(80)]);
    expect(booked.state).toBe("issueOpen");
    expect(booked.ctx.returnScheduled).toBe(true);
    expect(send(jobMachine, booked, { type: "SCHEDULE_RETURN" }, at(81)).ok).toBe(false);
    expect(run(next, [{ type: "CASE_RESOLVED" }, at(120)]).state).toBe("paymentReleased");
  });
  it("refuses a problem report that names no photo, and holds everything when the whole job is picked", () => {
    const s = ready();
    expect(send(jobMachine, s, { type: "REPORT_ISSUE", selected: ["mat"], category: "damage", description: "Scratch", photoCount: 0 }, at(76)).ok).toBe(false);
    expect(send(jobMachine, s, { type: "REPORT_ISSUE", selected: ["mat"], category: "", description: "Scratch", photoCount: 1 }, at(76)).ok).toBe(false);
    const whole = run(s, [{ type: "REPORT_ISSUE", selected: "wholeJob", category: "incomplete", description: "Not finished", photoCount: 2 }, at(76)]);
    expect(whole.ctx.heldAmount).toBe(4200);
    expect(whole.ctx.releasedAmount).toBe(0);
    expect(whole.ctx.releasedPayout).toBe(0);
  });
  it("does not let a regulated job skip pending review", () => {
    const s = run(createSnapshot(jobMachine, newJobCtx({ needsReview: true })),
      [{ type: "ESTIMATE_READY" }], [{ type: "RECOMMENDATIONS_READY" }],
      [{ type: "SELECT_PROFESSIONAL", professionalId: "p2" }],
      [{ type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines }]);
    expect(s.state).toBe("pendingReview");
    expect(allowedEvents(jobMachine, "pendingReview")).toEqual(["PENDING_REVIEW_APPROVED"]);
    expect(send(jobMachine, s, { type: "APPROVE_COMPLETION" }, t0).ok).toBe(false);
    expect(s.state).toBe("pendingReview");
  });
});

describe("photo upload queue", () => {
  it("keeps photos queued offline and uploads them on retry", () => {
    const q = createPhotoQueue(false);
    const photo = q.add("before", at(1), config.completionCheck.demoLocation);
    expect(photo.status).toBe("queued");
    expect(photo.location).toBe("San Pedro Garza García, N.L.");
    expect(photo.attempts).toBe(0);
    q.retry();
    expect(q.items[0]?.status).toBe("queued");
    expect(q.items[0]?.attempts).toBe(1);
    q.setOnline(true);
    expect(q.items[0]?.status).toBe("uploaded");
    expect(q.count("before", false)).toBe(1);
    q.add("after", at(2));
    expect(q.count("after")).toBe(1);
    expect(q.items.find((p) => p.phase === "after")?.status).toBe("uploaded");
  });
});
