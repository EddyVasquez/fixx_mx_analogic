import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Icon } from "@phosphor-icons/react";
import { Clock } from "@phosphor-icons/react/Clock";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Receipt } from "@phosphor-icons/react/Receipt";
import { Star } from "@phosphor-icons/react/Star";
import { Truck } from "@phosphor-icons/react/Truck";
import { formatDateTime } from "@/core/clock/clock";
import type { Lang } from "@/core/config/fixx.config";
import { JOB_STATUS_ORDER, type JobStatus } from "@/core/types/jobStatus";
import { localeFor } from "@/i18n";
import { colors } from "@/ui/tokens";
import {
  CURRENT_LINE_GAP_PX,
  PHASES,
  type PhaseId,
  meterStatus,
  meterStep,
  phaseIndexForStep
} from "./jobPhases";
import "./jobStatusBar.css";

const PHASE_ICONS: Record<PhaseId, Icon> = {
  request: PaperPlaneTilt,
  quote: Receipt,
  visit: Truck,
  finish: Star
};

const NEXT_MARK = "\u2063";

function languageOf(code: string): Lang {
  const base = code.toLowerCase().split("-")[0];
  return base === "es" || base === "ko" ? base : "en";
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

/**
 * Grouped phase meter. Progress is the step name, the step count, and the charcoal line.
 * High Viz Lime is only the current node's ring or glow — never text, and never a fill.
 */
export function JobStatusBar({ status, pendingReview = false, scheduledAt }: {
  status: JobStatus;
  /** Regulated job. Holds the meter at step 1 and hides the date and the Next line. */
  pendingReview?: boolean;
  /** Appointment. Omitted while a regulated job is still pending review. */
  scheduledAt?: Date;
}) {
  const { t, i18n } = useTranslation();
  const lang = languageOf(i18n.language);
  const shown = meterStatus(status, pendingReview);
  const current = meterStep(status, pendingReview);
  const total = JOB_STATUS_ORDER.length;
  const phaseIndex = phaseIndexForStep(current);
  const label = t(`status.${shown}`);
  const nextKey = pendingReview ? undefined : JOB_STATUS_ORDER[current];
  const nextLabel = nextKey ? t(`status.${nextKey}`) : undefined;
  const hasSchedule = !pendingReview && scheduledAt != null && scheduledAt.getTime() > 0;
  const railStyle = {
    "--to-current": `${phaseIndex * 25}%`,
    "--line-gap": `${CURRENT_LINE_GAP_PX}px`
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
        <p className={lang === "ko" ? "job-meter-title job-meter-title-ko" : "job-meter-title"}>{label}</p>
        <p className="job-meter-step">{t("status.step", { current, total })}</p>
        <div
          className="job-meter-rail"
          style={railStyle}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current}
          aria-valuetext={label}
        >
          {phaseIndex > 0 && <span className="job-meter-line job-meter-line-done" aria-hidden="true" />}
          {phaseIndex < PHASES.length - 1 && <span className="job-meter-line job-meter-line-rest" aria-hidden="true" />}
          {PHASES.map((phase, index) => {
            const state = index < phaseIndex ? "done" : index === phaseIndex ? "current" : "upcoming";
            const PhaseIcon = PHASE_ICONS[phase.id];
            return (
              <div className="job-meter-slot" key={phase.id} aria-hidden="true">
                <div className={`job-meter-node job-meter-node-${state}`} data-phase={phase.id}>
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
                    </>
                  )}
                  <PhaseIcon
                    className="job-meter-icon"
                    aria-hidden="true"
                    size={16}
                    weight="bold"
                    color={state === "upcoming" ? colors.ink : colors.mist}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="job-meter-labels">
          {PHASES.map((phase, index) => (
            <span key={phase.id} className={index === phaseIndex ? "is-now" : undefined}>{t(`status.phase.${phase.id}`)}</span>
          ))}
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
