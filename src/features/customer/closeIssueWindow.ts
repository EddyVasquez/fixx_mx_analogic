import type { JobCtx } from "@/core/machines";
import type { DemoRuntime } from "@/mocks/runtime/runtime";

/**
 * The issue window closes on a timer (24 hours). In the demo, move the clock to that
 * moment so the scheduled close runs and the status path can continue.
 */
export function closeIssueWindow(rt: DemoRuntime, jobId: string): { ok: boolean; error?: string } {
  const actor = rt.get(jobId);
  if (!actor || actor.snap.state !== "issueWindow") return { ok: false, error: "not in the issue window" };
  const ends = (actor.snap.ctx as JobCtx).issueWindowEndsAt;
  if (!ends) return { ok: false, error: "the issue window has no end time" };
  const lateBy = ends.getTime() - rt.clock.now().getTime();
  if (lateBy > 0) rt.clock.advance(lateBy);
  rt.advanceHours(0);
  const state = rt.get(jobId)?.snap.state;
  if (state === "paymentReleased" || state === "rated") return { ok: true };
  return rt.dispatch(jobId, { type: "WINDOW_CLOSED" });
}
