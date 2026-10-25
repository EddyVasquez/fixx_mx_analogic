import { rescheduleMachine, newReschedule, type RescheduleCtx, type RescheduleState } from "../../core/machines/reschedule";
import { notify, send, type Snapshot } from "../../core/machines/machine";
import type { DemoRuntime } from "./runtime";

const rid = (jobId: string) => `resch:${jobId}`;
export type RescheduleStatus = "none" | "pending" | "accepted" | "declined" | "expired";
type Snap = Snapshot<RescheduleState, RescheduleCtx>;

/** Where a reschedule request stands. Pending past its 12-hour window counts as expired. */
export function rescheduleStatus(rt: DemoRuntime, jobId: string): { status: RescheduleStatus; proposedStart?: Date; expiresAt?: Date } {
  const a = rt.get(rid(jobId));
  if (!a) return { status: "none" };
  const ctx = a.snap.ctx as RescheduleCtx;
  const st = a.snap.state as RescheduleState;
  const status: RescheduleStatus = st === "pending" && rt.clock.now().getTime() >= ctx.expiresAt.getTime() ? "expired" : st;
  return { status, proposedStart: ctx.proposedStart, expiresAt: ctx.expiresAt };
}

/**
 * Customer asks for a new time. Free until the professional is on the way. The current time stays booked
 * until the professional accepts; with no answer in the window, the request expires.
 */
export function requestReschedule(rt: DemoRuntime, jobId: string, proposedStart: Date): { ok: boolean; error?: string } {
  const job = rt.get(jobId);
  if (!job || job.snap.state !== "scheduled") return { ok: false, error: "the time can only be changed before the professional is on the way" };
  if (rescheduleStatus(rt, jobId).status === "pending") return { ok: false, error: "a request is already waiting for an answer" };
  const now = rt.clock.now();
  const ctx = newReschedule(now, proposedStart);
  rt.spawn(rid(jobId), "reschedule", rescheduleMachine, ctx);
  rt.scheduler.add(jobId, ctx.expiresAt, { type: "RESCHEDULE_EXPIRED" }, "reschedule expires");
  rt.announce(jobId, [notify("reschedule.requested", ["professional"], "urgent"), notify("reschedule.requestSent", ["customer"])], now);
  return { ok: true };
}

function answer(rt: DemoRuntime, jobId: string, type: "ACCEPT" | "DECLINE"): { ok: boolean; error?: string } {
  const a = rt.get(rid(jobId));
  if (!a) return { ok: false, error: "there is no request to answer" };
  const checked = send(rescheduleMachine, a.snap as unknown as Snap, { type }, rt.clock.now()); // enforces the 12-hour window
  if (!checked.ok) return { ok: false, error: checked.error };
  const res = rt.dispatch(jobId, type === "ACCEPT" ? { type: "RESCHEDULE_ACCEPTED", newStart: (a.snap.ctx as RescheduleCtx).proposedStart } : { type: "RESCHEDULE_DECLINED" });
  if (!res.ok) return res;
  a.snap = checked.snapshot as unknown as typeof a.snap; // the job machine sends the messages
  rt.scheduler.cancel((t) => t.actorId === jobId && t.event.type === "RESCHEDULE_EXPIRED");
  return { ok: true };
}
export const acceptReschedule = (rt: DemoRuntime, jobId: string) => answer(rt, jobId, "ACCEPT");
export const declineReschedule = (rt: DemoRuntime, jobId: string) => answer(rt, jobId, "DECLINE");
