import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "@phosphor-icons/react/Check";
import "./jobChips.css";

/** How many chips show before "Show all". */
export const JOBS_VISIBLE = 8;

export interface JobOption {
  id: string;
  label: string;
  keepCase?: boolean;
  /** Shown under the chip. Regulated jobs use this for "Pending review". */
  status?: string;
  /** When set, the chip stays focusable but does not toggle. The text explains why. */
  disabledReason?: string;
}

/**
 * Multi-select job chips. Mouse, touch and keyboard all toggle aria-pressed.
 * A drag or scroll that starts on a chip does not toggle it.
 */
export function JobChips({
  headingId,
  jobs,
  selectedIds,
  onChange
}: {
  headingId: string;
  jobs: readonly JobOption[];
  selectedIds: readonly string[];
  onChange: (nextIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState("");
  const visible = expanded ? jobs : jobs.slice(0, JOBS_VISIBLE);
  const hidden = jobs.length - visible.length;

  const toggle = (job: JobOption) => {
    if (job.disabledReason) return;
    const selected = selectedIds.includes(job.id);
    const next = selected ? selectedIds.filter((id) => id !== job.id) : [...selectedIds, job.id];
    onChange(next);
    const phrase = selected
      ? t("request.jobUnselected", { job: job.label })
      : t("request.jobSelected", { job: job.label });
    setLive(`${phrase}, ${t("request.jobsCount", { n: next.length })}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
        {visible.map((job) => (
          <JobChip key={job.id} job={job} pressed={selectedIds.includes(job.id)} onToggle={() => toggle(job)} />
        ))}
      </div>
      {hidden > 0 && (
        <button type="button" className="min-h-touch self-start px-1 text-left text-sm font-semibold text-ink underline" onClick={() => setExpanded(true)}>
          {t("request.showAll", { n: jobs.length })}
        </button>
      )}
      <p className="sr-only" aria-live="polite">{live}</p>
    </div>
  );
}

function JobChip({ job, pressed, onToggle }: { job: JobOption; pressed: boolean; onToggle: () => void }) {
  const drag = useRef({ x: 0, y: 0, moved: false, tracking: false });
  const ignoreClick = useRef(false);
  const whyId = `${job.id}-why`;
  const note = job.disabledReason ?? job.status;
  return (
    <div className="flex max-w-full flex-col">
      <button
        type="button"
        aria-pressed={pressed}
        aria-disabled={job.disabledReason ? true : undefined}
        aria-describedby={note ? whyId : undefined}
        className="job-chip inline-flex min-h-touch w-fit max-w-full items-center gap-2 rounded-full px-4 py-[10px] text-left text-[15px]"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, moved: false, tracking: true };
        }}
        onPointerMove={(event) => {
          if (!drag.current.tracking) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          if (dx * dx + dy * dy > 100) drag.current.moved = true;
        }}
        onPointerUp={() => { drag.current.tracking = false; }}
        onPointerCancel={() => { drag.current.moved = true; drag.current.tracking = false; }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (job.disabledReason) return;
          ignoreClick.current = true;
          window.setTimeout(() => { ignoreClick.current = false; }, 0);
          onToggle();
        }}
        onClick={() => {
          if (ignoreClick.current) {
            ignoreClick.current = false;
            return;
          }
          if (drag.current.moved) {
            drag.current.moved = false;
            return;
          }
          if (job.disabledReason) return;
          onToggle();
        }}
      >
        {pressed && <Check aria-hidden="true" size={16} weight="bold" />}
        <span className="min-w-0 whitespace-normal break-words">{job.label}</span>
      </button>
      {note && <span id={whyId} className="max-w-full break-words px-4 text-sm text-inkSoft">{note}</span>}
    </div>
  );
}
