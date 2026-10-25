import { caseResolutionDue, reviewDeadline } from "../rules";
import { notify, reject, type Effect, type MachineDef, type Outcome } from "./machine";

export type CaseState = "reported" | "underReview" | "decided" | "inReview" | "final";
export type Party = "customer" | "professional";
export type CaseEvent =
  | { type: "START_REVIEW" } | { type: "DECIDE"; decision: string }
  | { type: "REQUEST_REVIEW"; by: Party } | { type: "REVIEW_DECIDED"; decision: string } | { type: "DEADLINE_PASSED" };
export interface CaseCtx {
  reportedAt: Date; resolveBy: Date; heldAmount: number; heldPayout: number;
  decision: string | null; decidedAt: Date | null; reviewBy: Date | null; reviewsUsed: Party[]; decisionVersion: number;
}
export const newCase = (reportedAt: Date, heldAmount: number, heldPayout: number): CaseCtx => ({
  reportedAt, resolveBy: caseResolutionDue(reportedAt), heldAmount, heldPayout,
  decision: null, decidedAt: null, reviewBy: null, reviewsUsed: [], decisionVersion: 0
});

const ALL = ["customer" as const, "professional" as const, "admin" as const];
const go = (t: CaseState, fx: Effect[], ctx?: Partial<CaseCtx>): Outcome<CaseState, CaseCtx> => ({ target: t, effects: fx, ...(ctx ? { ctx } : {}) });

/** Each party may ask for ONE review of a decision until the review deadline; after that the decision is final. */
export const caseMachine: MachineDef<CaseState, CaseEvent, CaseCtx> = {
  id: "case", initial: "reported",
  on: {
    reported: { START_REVIEW: () => go("underReview", [notify("case.underReview", ALL)]) },
    underReview: {
      DECIDE: (c, e, now) => go("decided", [notify("case.decided", ALL, "urgent")],
        { decision: e.decision, decidedAt: now, reviewBy: reviewDeadline(now), decisionVersion: c.decisionVersion + 1 })
    },
    decided: {
      REQUEST_REVIEW: (c, e, now) => {
        if (!c.reviewBy || now.getTime() > c.reviewBy.getTime()) return reject("the review deadline has passed");
        if (c.reviewsUsed.includes(e.by)) return reject("this party already used its one review");
        return go("inReview", [notify("case.reviewRequested", ALL, "urgent")], { reviewsUsed: [...c.reviewsUsed, e.by] });
      },
      DEADLINE_PASSED: (c, _e, now) => c.reviewBy && now.getTime() > c.reviewBy.getTime()
        ? go("final", [notify("case.final", ALL, "record")]) : reject("the review deadline has not passed yet")
    },
    inReview: {
      REVIEW_DECIDED: (c, e, now) => {
        const done = c.reviewsUsed.length >= 2;
        return go(done ? "final" : "decided", [notify(done ? "case.final" : "case.reviewDecided", ALL, done ? "record" : "urgent")],
          { decision: e.decision, decidedAt: now, decisionVersion: c.decisionVersion + 1 });
      }
    }
  }
};
