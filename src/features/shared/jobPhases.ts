import { JOB_STATUS_ORDER, type JobStatus } from "@/core/types/jobStatus";

/** Four phases over the twelve real statuses. Labels come from status.phase.*. */
export const PHASES = [
  { id: "request", from: 1, to: 2 },
  { id: "quote", from: 3, to: 5 },
  { id: "visit", from: 6, to: 9 },
  { id: "finish", from: 10, to: 12 }
] as const;

export type PhaseId = (typeof PHASES)[number]["id"];

/** R2 turning ring. High Viz Lime is the stroke and its glow, never a fill. */
export const R2_RADIUS_PX = 21;
export const R2_STROKE_PX = 3;
/** Outer edge of the 3px stroke (the radius plus half the stroke). */
export const R2_OUTER_PX = R2_RADIUS_PX + R2_STROKE_PX / 2;
/** drop-shadow blur on the turning arc. */
export const R2_GLOW_PX = 10;

/** Reduced-motion fallback: a static full ring (R1). Outer radius of the 46px ring. */
export const R1_OUTER_PX = 23;
/** Larger box-shadow blur on that static ring. */
export const R1_GLOW_PX = 18;

/** Paper still showing past the glow, before a connector begins. */
export const LINE_CLEARANCE_PX = 4;

/**
 * Both connectors stop this far from the current node center.
 * Sized so the turning arc and the static ring, including their glow, stay off the line.
 * The same distance is used on both sides.
 */
export const CURRENT_LINE_GAP_PX = Math.max(
  R2_OUTER_PX + R2_GLOW_PX + LINE_CLEARANCE_PX,
  R1_OUTER_PX + R1_GLOW_PX + LINE_CLEARANCE_PX
);

export function stepNumber(status: JobStatus): number {
  return JOB_STATUS_ORDER.indexOf(status) + 1;
}

export function phaseForStep(step: number): PhaseId {
  const phase = PHASES.find((item) => step >= item.from && step <= item.to);
  return phase?.id ?? "finish";
}

export function phaseIndexForStep(step: number): number {
  const index = PHASES.findIndex((item) => step >= item.from && step <= item.to);
  return index < 0 ? PHASES.length - 1 : index;
}

export function phaseForStatus(status: JobStatus): PhaseId {
  return phaseForStep(stepNumber(status));
}

/** Regulated jobs wait at step 1 until a person approves them. */
export function meterStatus(status: JobStatus, pendingReview = false): JobStatus {
  return pendingReview ? "requestSubmitted" : status;
}

export function meterStep(status: JobStatus, pendingReview = false): number {
  return stepNumber(meterStatus(status, pendingReview));
}
