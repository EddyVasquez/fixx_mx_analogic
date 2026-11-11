import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Icon } from "@phosphor-icons/react";
import { CalendarCheck } from "@phosphor-icons/react/CalendarCheck";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Clock } from "@phosphor-icons/react/Clock";
import { Handshake } from "@phosphor-icons/react/Handshake";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Receipt } from "@phosphor-icons/react/Receipt";
import { ShieldWarning } from "@phosphor-icons/react/ShieldWarning";
import { Star } from "@phosphor-icons/react/Star";
import { Tag } from "@phosphor-icons/react/Tag";
import { Truck } from "@phosphor-icons/react/Truck";
import { UserCheck } from "@phosphor-icons/react/UserCheck";
import { Wallet } from "@phosphor-icons/react/Wallet";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { formatDateTime } from "@/core/clock/clock";
import type { Lang } from "@/core/config/fixx.config";
import { JOB_STATUS_ORDER, type JobStatus } from "@/core/types/jobStatus";
import { localeFor } from "@/i18n";
import { colors } from "@/ui/tokens";
import {
  CAPTION_MAX_PX,
  CURRENT_LINE_GAP_PX,
  NODE_PX,
  RAIL_FULL_MAX_PX,
  STRIP_GAP_PX,
  STRIP_INSET_PX,
  STRIP_STRIDE_PX,
  VIEWPORT_FULL_MIN_PX,
  captionAlign,
  edgeFadeVisibility,
  clampProgress,
  meterStatus,
  meterStep,
  meterUsesFullRow,
  stripContentWidth,
  stripFits,
  stripScrollLeft
} from "./jobPhases";
import "./jobStatusBar.css";

/** Phosphor bold, one icon per real step. Lime is never the glyph. */
export const STEP_ICONS: Record<JobStatus, Icon> = {
  requestSubmitted: PaperPlaneTilt,
  estimated: Tag,
  professionalSelected: UserCheck,
  quoteSent: Receipt,
  quoteAccepted: Handshake,
  scheduled: CalendarCheck,
  onTheWay: Truck,
  inProgress: Wrench,
  markedComplete: CheckCircle,
  issueWindow: ShieldWarning,
  paymentReleased: Wallet,
  rated: Star
};

const NEXT_MARK = "\u2063";
const WIDE_QUERY = `(min-width: ${VIEWPORT_FULL_MIN_PX}px)`;
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function languageOf(code: string): Lang {
  const base = code.toLowerCase().split("-")[0];
  return base === "es" || base === "ko" ? base : "en";
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(REDUCE_QUERY).matches;
}

function viewportIsWide(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches;
}

function NextLine({ step }: { step: string }) {
  const { t } = useTranslation();
  const [before, after] = t("status.next", { step: NEXT_MARK }).split(NEXT_MARK);
  return (
    <p className="job-meter-next">
      {before}
      {after !== undefined && <span className="job-meter-next-step">{step}</span>}
      {after}
    </p>
  );
}

type Fades = { start: boolean; end: boolean };

/**
 * Strip below 768px, and also when the rail itself is under 674px.
 * Crossing either threshold re-centers the strip on the current step.
 * A strip with nothing to scroll is centered, and both edge fades stay hidden.
 */
function useMeterLayout(railRef: RefObject<HTMLDivElement | null>, current: number): { full: boolean; fades: Fades; fits: boolean } {
  const [full, setFull] = useState(false);
  const [fits, setFits] = useState(false);
  const [fades, setFades] = useState<Fades>({ start: false, end: false });

  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const wideMedia = typeof window.matchMedia === "function" ? window.matchMedia(WIDE_QUERY) : null;

    const contentWidth = () => (el.scrollWidth > el.clientWidth ? el.scrollWidth : stripContentWidth());

    const paintFades = (scrollLeft: number, hideBoth: boolean) => {
      const next = hideBoth
        ? { start: false, end: false }
        : edgeFadeVisibility(scrollLeft, el.clientWidth, contentWidth());
      setFades((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };

    const onScroll = () => {
      const width = el.clientWidth;
      if (meterUsesFullRow(wideMedia?.matches ?? false, width) || stripFits(width)) return;
      paintFades(el.scrollLeft, false);
    };

    let aimed = -1;
    const place = () => {
      const width = el.clientWidth;
      const nextFull = meterUsesFullRow(wideMedia?.matches ?? viewportIsWide(), width);
      const nextFits = !nextFull && stripFits(width);
      setFull((prev) => (prev === nextFull ? prev : nextFull));
      setFits((prev) => (prev === nextFits ? prev : nextFits));
      if (nextFull || width <= 0 || nextFits) {
        aimed = -1;
        if (nextFits && el.scrollLeft > 1) el.scrollLeft = 0;
        paintFades(0, true);
        return;
      }
      const left = stripScrollLeft(current, width);
      const alreadyThere = Math.abs(el.scrollLeft - left) <= 1;
      const alreadyAimed = Math.abs(aimed - left) <= 1;
      if (!alreadyThere && !alreadyAimed) {
        aimed = left;
        const behavior = reducedMotion() ? "auto" : "smooth";
        if (typeof el.scrollTo === "function") el.scrollTo({ left, behavior });
        else el.scrollLeft = left;
      } else if (alreadyThere) {
        aimed = left;
      }
      paintFades(left, false);
    };

    place();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
    observer?.observe(el);
    wideMedia?.addEventListener("change", place);
    window.addEventListener("resize", place);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      wideMedia?.removeEventListener("change", place);
      window.removeEventListener("resize", place);
      el.removeEventListener("scroll", onScroll);
    };
  }, [current, railRef]);

  return { full, fades, fits };
}

/**
 * Twelve-step meter. Progress is the step name, the step count, and the charcoal line.
 * High Viz Lime is the current ring, and the partial connector while a step is underway.
 * It is never text. Nodes are decorative. The strip may be swiped; it is not a control.
 */
export function JobStatusBar({ status, pendingReview = false, scheduledAt, progress, stage, tradeName }: {
  status: JobStatus;
  /** Regulated job. Holds the meter at step 1 and hides the date and the Next line. */
  pendingReview?: boolean;
  /** Appointment. Omitted while a regulated job is still pending review. */
  scheduledAt?: Date;
  /**
   * Fraction of this step's sub-steps that are done (0..1).
   * Omit it when the step has no sub-steps: the connector then fills halfway.
   * Ignored before a trade is chosen and while a regulated job is held for review.
   */
  progress?: number;
  /** Before submit: "choose" until a trade is picked, then "requesting" until Send request. */
  stage?: "choose" | "requesting";
  /** Localized trade name for the requesting heading. */
  tradeName?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = languageOf(i18n.language);
  const shown = meterStatus(status, pendingReview);
  const placing = stage === "choose" || stage === "requesting";
  const current = placing ? 1 : meterStep(status, pendingReview);
  const total = JOB_STATUS_ORDER.length;
  const label = t(`status.${shown}`);
  const title = stage === "choose"
    ? t("status.chooseService")
    : stage === "requesting"
      ? t("status.serviceChosen", { trade: tradeName ?? "" })
      : label;
  const caption = stage === "requesting" ? t("status.requesting") : label;
  const nextKey = pendingReview || stage === "choose" ? undefined : JOB_STATUS_ORDER[current];
  const nextLabel = nextKey ? t(`status.${nextKey}`) : undefined;
  const hasSchedule = !pendingReview && stage == null && scheduledAt != null && scheduledAt.getTime() > 0;
  const index = current - 1;
  const fraction = pendingReview || stage === "choose"
    ? undefined
    : progress != null
      ? clampProgress(progress)
      : index < total - 1 ? 0.5 : undefined;
  const percentMode = progress != null && !pendingReview && stage !== "choose";
  const percent = percentMode && fraction != null ? Math.round(fraction * 100) : undefined;
  const ariaStep = stage === "requesting" ? caption : stage === "choose" ? title : label;
  const railRef = useRef<HTMLDivElement>(null);
  const { full, fades, fits } = useMeterLayout(railRef, current);
  const showPartial = fraction != null && fraction > 0 && index < total - 1 && stage !== "choose";
  const railStyle = {
    "--index": String(index),
    "--progress": String(fraction ?? 0),
    "--line-gap": `${CURRENT_LINE_GAP_PX}px`,
    "--node": `${NODE_PX}px`,
    "--stride": `${STRIP_STRIDE_PX}px`,
    "--strip-gap": `${STRIP_GAP_PX}px`,
    "--strip-inset": `${STRIP_INSET_PX}px`,
    "--rail-max": `${RAIL_FULL_MAX_PX}px`,
    "--caption-max": `${CAPTION_MAX_PX}px`
  } as CSSProperties;

  return (
    <div role="group" aria-label={t("status.label")} className="job-meter">
      {pendingReview && (
        <p className="job-meter-badge">
          <Clock aria-hidden="true" size={16} weight="bold" color={colors.ink} />
          {t("review.pending.title")}
        </p>
      )}
      <div className="job-meter-panel">
        <p className={lang === "ko" ? "job-meter-title job-meter-title-ko" : "job-meter-title"}>{title}</p>
        <p className="job-meter-step">{t("status.step", { current, total })}</p>
        <div
          className="job-meter-frame"
          data-layout={full ? "full" : "strip"}
          role="progressbar"
          aria-valuemin={percent == null ? 1 : 0}
          aria-valuemax={percent == null ? total : 100}
          aria-valuenow={percent == null ? current : percent}
          aria-valuetext={percent == null ? ariaStep : t("status.stepProgress", { step: ariaStep, percent })}
        >
          <div
            className="job-meter-rail"
            ref={railRef}
            style={railStyle}
            data-layout={full ? "full" : "strip"}
            data-stage={stage ?? "status"}
            data-fits={!full && fits ? "true" : "false"}
            tabIndex={full ? undefined : -1}
          >
            <div className="job-meter-track">
              <div className="job-meter-nodes" aria-hidden="true">
                {index > 0 && <span className="job-meter-line job-meter-line-done" />}
                {index < total - 1 && <span className="job-meter-line job-meter-line-rest" />}
                {showPartial && <span className="job-meter-line job-meter-line-partial" />}
                {JOB_STATUS_ORDER.map((stepStatus, stepIndex) => {
                  const step = stepIndex + 1;
                  const state = stage === "choose" ? "upcoming" : step < current ? "done" : step === current ? "current" : "upcoming";
                  const Glyph = STEP_ICONS[stepStatus];
                  return (
                    <div
                      className={`job-meter-node job-meter-node-${state}`}
                      data-status={stepStatus}
                      data-step={step}
                      key={stepStatus}
                    >
                      {state === "current" && (
                        <>
                          <svg className="job-meter-arc" viewBox="0 0 48 48" aria-hidden="true">
                            <circle
                              cx="24"
                              cy="24"
                              r="21"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray="98.96 32.99"
                              transform="rotate(-30 24 24)"
                            />
                          </svg>
                          <span className="job-meter-r1" aria-hidden="true">
                            <span className="job-meter-r1-gap" />
                            <span className="job-meter-r1-ring" />
                          </span>
                          <p className="job-meter-caption" data-align={captionAlign(step)}>{caption}</p>
                        </>
                      )}
                      <Glyph
                        className="job-meter-icon"
                        aria-hidden="true"
                        size={16}
                        weight="bold"
                        color={state === "upcoming" ? colors.ink : colors.mist}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {!full && fades.start && <span className="job-meter-fade job-meter-fade-start" aria-hidden="true" />}
          {!full && fades.end && <span className="job-meter-fade job-meter-fade-end" aria-hidden="true" />}
        </div>
      </div>
      {nextLabel && <NextLine step={nextLabel} />}
      {hasSchedule && scheduledAt && (
        <p className="job-meter-chip">{t("timeline.when", { when: formatDateTime(scheduledAt, localeFor[lang]) })}</p>
      )}
      {pendingReview && <p className="job-meter-help">{t("review.pending.body")}</p>}
    </div>
  );
}

function useStuck(ref: RefObject<HTMLElement | null>): boolean {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setStuck(!entry.isIntersecting);
    }, { threshold: 1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return stuck;
}

/** Keeps the meter pinned under the tablet header, and at the top of the phone, while the journey scrolls. */
export function StickyJobMeter({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const stuck = useStuck(sentinel);
  return (
    <>
      <div className="job-meter-sentinel" ref={sentinel} aria-hidden="true" />
      <div className={stuck ? "job-meter-sticky is-stuck" : "job-meter-sticky"}>{children}</div>
    </>
  );
}
