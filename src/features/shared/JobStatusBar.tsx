import { useTranslation } from "react-i18next";
import { JOB_STATUS_ORDER, type JobStatus } from "@/core/types/jobStatus";

/** Visible job status. Progress is shown by filled vs. empty segments plus text, never by color alone. */
export function JobStatusBar({ status }: { status: JobStatus }) {
  const { t } = useTranslation();
  const total = JOB_STATUS_ORDER.length;
  const current = JOB_STATUS_ORDER.indexOf(status) + 1;
  const label = t(`status.${status}`);
  return (
    <div role="group" aria-label={t("status.label")} className="rounded-2xl border-2 border-ink bg-paper p-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-bold">{label}</span>
        <span className="text-sm text-inkSoft">{t("status.step", { current, total })}</span>
      </p>
      <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-valuetext={label}
        className="mt-2 flex gap-1">
        {JOB_STATUS_ORDER.map((s, i) => (
          <span key={s} className={`h-2 flex-1 rounded-full border border-ink ${i < current ? "bg-ink" : "bg-paper"}`} />
        ))}
      </div>
    </div>
  );
}
