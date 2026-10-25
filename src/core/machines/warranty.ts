import { warrantyEndsAt } from "../rules";
import { notify, reject, type Effect, type MachineDef, type Outcome } from "./machine";

export type WarrantyState = "running" | "claimFiled" | "inReview" | "expired";
export type WarrantyEvent =
  | { type: "FILE_CLAIM" } | { type: "START_REVIEW" } | { type: "RESOLVE"; outcome: "resolved" | "rejected" } | { type: "EXPIRE" };
export interface WarrantyCtx { startsAt: Date; endsAt: Date; claims: number; lastOutcome: "resolved" | "rejected" | null }
/** Starts at payment release (decision C5); length comes from per-category config. */
export const newWarranty = (startsAt: Date, categoryId: string): WarrantyCtx =>
  ({ startsAt, endsAt: warrantyEndsAt(startsAt, categoryId), claims: 0, lastOutcome: null });

const ALL = ["customer" as const, "professional" as const, "admin" as const];
const go = (t: WarrantyState, fx: Effect[], ctx?: Partial<WarrantyCtx>): Outcome<WarrantyState, WarrantyCtx> => ({ target: t, effects: fx, ...(ctx ? { ctx } : {}) });

export const warrantyMachine: MachineDef<WarrantyState, WarrantyEvent, WarrantyCtx> = {
  id: "warranty", initial: "running",
  on: {
    running: {
      FILE_CLAIM: (c, _e, now) => now.getTime() >= c.endsAt.getTime() ? reject("the warranty has ended")
        : go("claimFiled", [notify("warranty.claimFiled", ALL, "urgent")], { claims: c.claims + 1 }),
      EXPIRE: (c, _e, now) => now.getTime() < c.endsAt.getTime() ? reject("the warranty is still running")
        : go("expired", [notify("warranty.ended", ["customer"], "record")])
    },
    claimFiled: { START_REVIEW: () => go("inReview", [notify("warranty.inReview", ALL)]) },
    inReview: {
      RESOLVE: (c, e, now) => go(now.getTime() >= c.endsAt.getTime() ? "expired" : "running",
        [notify("warranty.claimDecided", ALL, "urgent", { outcome: e.outcome })], { lastOutcome: e.outcome })
    }
  }
};
