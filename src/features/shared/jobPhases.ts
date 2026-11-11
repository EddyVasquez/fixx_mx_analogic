import { JOB_STATUS_ORDER, type JobStatus } from "@/core/types/jobStatus";

/**
 * Phase groups over the twelve statuses. The meter no longer draws these labels —
 * every step has its own icon — but the grouping stays available.
 */
export const PHASES = [
  { id: "request", from: 1, to: 2 },
  { id: "quote", from: 3, to: 5 },
  { id: "visit", from: 6, to: 9 },
  { id: "finish", from: 10, to: 12 }
] as const;

export type PhaseId = (typeof PHASES)[number]["id"];

/** R2 turning ring. High Viz Lime is the stroke only; the soft glow is not part of the line stop. */
export const R2_RADIUS_PX = 21;
export const R2_STROKE_PX = 3;
/** Outer edge of the 3px stroke (the radius plus half the stroke). */
export const R2_OUTER_PX = R2_RADIUS_PX + R2_STROKE_PX / 2;

/** Reduced-motion fallback: a static full ring (R1). Outer radius of the 46px ring. */
export const R1_OUTER_PX = 23;

/** Clear paper between a connector cap and the ring's outer edge. Glow is ignored. */
export const LINE_CLEARANCE_PX = 2;

/**
 * Both connectors stop this far from the current node center.
 * That is about 2px outside the lime ring (the larger of the turning arc and the static ring).
 * The same distance is used on both sides, so the arc never crosses a line.
 */
export const CURRENT_LINE_GAP_PX = Math.max(R2_OUTER_PX, R1_OUTER_PX) + LINE_CLEARANCE_PX;

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

/** One node per real status. */
export const STEP_COUNT = JOB_STATUS_ORDER.length;

export const NODE_PX = 36;
/** Gap between node edges on the phone strip. Stride is 50px. */
export const STRIP_GAP_PX = 14;
export const STRIP_STRIDE_PX = NODE_PX + STRIP_GAP_PX;

/**
 * Room inside the scrolling strip so the current ring is not cut off when a
 * node is clamped to an end. The strip clips overflow in order to scroll.
 * The full row does not scroll, so its glow spills into the panel padding
 * and this inset is not applied there.
 */
export const STRIP_INSET_PX = 14;

/** Full row: edge-to-edge gap between the 36px nodes. */
export const FULL_GAP_MIN_PX = 22;
export const FULL_GAP_MAX_PX = 48;

/** 12×36 + 11×22. A narrower rail stays on the strip. */
export const RAIL_FULL_MIN_PX = NODE_PX * STEP_COUNT + FULL_GAP_MIN_PX * (STEP_COUNT - 1);

/** 12×36 + 11×48. The full row is capped here and centered. */
export const RAIL_FULL_MAX_PX = NODE_PX * STEP_COUNT + FULL_GAP_MAX_PX * (STEP_COUNT - 1);

/** Matches the app's tablet breakpoint. Below this the meter stays a strip. */
export const VIEWPORT_FULL_MIN_PX = 768;

/** Short label under the current node. Wraps to two lines, never truncates. */
export const CAPTION_MAX_PX = 140;

export const FADE_PX = 24;

/** Full row only when the viewport is at the tablet breakpoint and the rail can hold a 22px gap. */
export function meterUsesFullRow(viewportWide: boolean, railWidth: number): boolean {
  return viewportWide && railWidth >= RAIL_FULL_MIN_PX;
}

/** The strip has nothing to scroll when its row is narrower than the rail. */
export function stripFits(railWidth: number): boolean {
  return railWidth > 0 && stripContentWidth() <= railWidth;
}

export function stripContentWidth(): number {
  return STRIP_INSET_PX * 2 + NODE_PX * STEP_COUNT + STRIP_GAP_PX * (STEP_COUNT - 1);
}

/** Center of a strip node, including the ring inset at the ends. */
export function stripNodeCenter(step: number): number {
  const index = clampStep(step) - 1;
  return STRIP_INSET_PX + index * STRIP_STRIDE_PX + NODE_PX / 2;
}

/**
 * Scroll offset that centers the current node, then clamps so the first and
 * last steps sit against the ends instead of floating in an empty rail.
 */
export function stripScrollLeft(step: number, viewportWidth: number): number {
  const contentWidth = stripContentWidth();
  const maxScroll = Math.max(0, contentWidth - Math.max(0, viewportWidth));
  const target = stripNodeCenter(step) - viewportWidth / 2;
  return Math.min(maxScroll, Math.max(0, target));
}

/** Width of the full-row track. Capped so the gap never exceeds 48px. */
export function fullRowTrackWidth(railWidth: number): number {
  return Math.min(Math.max(0, railWidth), RAIL_FULL_MAX_PX);
}

/** Edge-to-edge gap once the track is capped. Below 674px this is under 22px, so the strip is used instead. */
export function fullRowGap(railWidth: number): number {
  return (fullRowTrackWidth(railWidth) - NODE_PX * STEP_COUNT) / (STEP_COUNT - 1);
}

/**
 * Connector still showing between the line stop and the neighbouring node edge.
 * The stop is CURRENT_LINE_GAP_PX from the current node's center.
 */
export function visibleLinePx(gap: number): number {
  return NODE_PX / 2 + gap - CURRENT_LINE_GAP_PX;
}

/** Center of a full-row node inside a track of `trackWidth`. */
export function fullNodeCenter(step: number, trackWidth: number): number {
  const index = clampStep(step) - 1;
  const span = Math.max(0, trackWidth - NODE_PX);
  return NODE_PX / 2 + (span * index) / (STEP_COUNT - 1);
}

export type CaptionAlign = "start" | "center" | "end";

/** Step 1 stays left-aligned on the rail. Step 12 stays right-aligned. The rest are centered on the node. */
export function captionAlign(step: number): CaptionAlign {
  if (step <= 1) return "start";
  if (step >= STEP_COUNT) return "end";
  return "center";
}

/**
 * Paper fades on the strip. A fade is hidden on the side that has reached
 * its scroll end, so a clamped step is not covered.
 */
export function edgeFadeVisibility(scrollLeft: number, clientWidth: number, scrollWidth: number): { start: boolean; end: boolean } {
  const maxScroll = Math.max(0, scrollWidth - Math.max(0, clientWidth));
  const atStart = scrollLeft <= 1;
  const atEnd = scrollLeft >= maxScroll - 1;
  return { start: !atStart, end: !atEnd };
}

function clampStep(step: number): number {
  return Math.min(STEP_COUNT, Math.max(1, Math.round(step)));
}

/** Sub-step fraction for the current node. Values outside 0..1 are clamped. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
