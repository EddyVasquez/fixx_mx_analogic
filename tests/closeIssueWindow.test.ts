import { describe, it, expect } from "vitest";
import { Clock } from "../src/core/clock/clock";
import { addHours } from "../src/core/rules";
import { jobMachine, newJobCtx, statusFor, type JobCtx } from "../src/core/machines";
import { JOB_STATUS_ORDER } from "../src/core/types/jobStatus";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { send } from "../src/core/machines/machine";
import { closeIssueWindow } from "../src/features/customer/closeIssueWindow";

const t0 = new Date("2026-10-06T16:00:00Z");
const LINES = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "work", amount: 2200 }];

function stepOf(state: string): number {
  const status = statusFor(state as never);
  return status ? JOB_STATUS_ORDER.indexOf(status) + 1 : 0;
}

/** Card job walked to the issue window, the same place the request status demo stops. */
function atIssueWindow() {
  const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
  rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p2" }), { categoryId: "painting" });
  const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error(r.error); };
  go({ type: "ESTIMATE_READY" });
  go({ type: "RECOMMENDATIONS_READY" });
  go({ type: "SELECT_PROFESSIONAL", professionalId: "p2" });
  go({ type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines: LINES });
  go({ type: "ACCEPT_QUOTE", method: "card", jobStart: addHours(rt.clock.now(), 30) });
  const due = (rt.get("job")!.snap.ctx as JobCtx).initialDue;
  go({ type: "PAYMENT_SATISFIED", amount: due });
  for (const type of ["ON_THE_WAY", "CHECK_IN", "START_WORK", "CHECKLIST_COMPLETE", "MARK_COMPLETE", "BALANCE_PAID"]) go({ type });
  return rt;
}

describe("request status demo past step 10", () => {
  it("stops on step 10, the issue window, until the window is closed", () => {
    const rt = atIssueWindow();
    const snap = rt.get("job")!.snap;
    expect(snap.state).toBe("issueWindow");
    expect(stepOf(snap.state)).toBe(10);
    expect(send(jobMachine, snap, { type: "WINDOW_CLOSED" }, rt.clock.now()).ok).toBe(false);
    expect(closeIssueWindow(rt, "missing").ok).toBe(false);
  });

  it("closing the window continues to payment released and then a rating", () => {
    const rt = atIssueWindow();
    expect(closeIssueWindow(rt, "job").ok).toBe(true);
    expect(rt.get("job")?.snap.state).toBe("paymentReleased");
    expect(stepOf("paymentReleased")).toBe(11);
    expect(rt.dispatch("job", { type: "RATE" }).ok).toBe(true);
    expect(rt.get("job")?.snap.state).toBe("rated");
    expect(stepOf("rated")).toBe(12);
    expect(rt.get("warranty:job")?.snap.state).toBe("running");
  });

  it("does not close a job that is not in the issue window", () => {
    const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
    rt.spawn("job", "job", jobMachine, newJobCtx(), { categoryId: "painting" });
    expect(closeIssueWindow(rt, "job").ok).toBe(false);
    expect(rt.get("job")?.snap.state).toBe("submitted");
  });
});
