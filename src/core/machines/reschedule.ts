import { rescheduleExpiry } from "../rules";
import { notify, reject, type Effect, type MachineDef, type Outcome } from "./machine";

export type RescheduleState = "pending" | "accepted" | "declined" | "expired";
export type RescheduleEvent = { type: "ACCEPT" } | { type: "DECLINE" } | { type: "EXPIRE" };
export interface RescheduleCtx { requestedAt: Date; expiresAt: Date; proposedStart: Date }
export const newReschedule = (requestedAt: Date, proposedStart: Date): RescheduleCtx =>
  ({ requestedAt, expiresAt: rescheduleExpiry(requestedAt), proposedStart });

const go = (t: RescheduleState, fx: Effect[]): Outcome<RescheduleState, RescheduleCtx> => ({ target: t, effects: fx });
const both = ["customer" as const, "professional" as const];

/** The current time stays booked until acceptance. Unanswered after 12 hours = expired. */
export const rescheduleMachine: MachineDef<RescheduleState, RescheduleEvent, RescheduleCtx> = {
  id: "reschedule", initial: "pending",
  on: {
    pending: {
      ACCEPT: (c, _e, now) => now.getTime() >= c.expiresAt.getTime() ? reject("the request has expired") : go("accepted", [notify("reschedule.accepted", both, "urgent")]),
      DECLINE: (c, _e, now) => now.getTime() >= c.expiresAt.getTime() ? reject("the request has expired") : go("declined", [notify("reschedule.declined", ["customer"], "urgent")]),
      EXPIRE: (c, _e, now) => now.getTime() < c.expiresAt.getTime() ? reject("the 12-hour window is still open") : go("expired", [notify("reschedule.expired", ["customer"], "urgent")])
    }
  }
};
