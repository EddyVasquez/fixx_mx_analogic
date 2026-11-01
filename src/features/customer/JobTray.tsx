import { useTranslation } from "react-i18next";

/** How many chosen job names the tray spells out before "+N". */
export const TRAY_NAME_LIMIT = 2;

export function trayWindow(labels: readonly string[], limit = TRAY_NAME_LIMIT): { shown: string[]; extra: number } {
  const shown = labels.slice(0, Math.max(limit, 0));
  return { shown, extra: Math.max(0, labels.length - shown.length) };
}

/** Dark glass bar pinned to the bottom of the screen while at least one job is chosen. */
export function JobTray({ labels, onContinue }: { labels: readonly string[]; onContinue: () => void }) {
  const { t } = useTranslation();
  if (labels.length === 0) return null;
  const { shown, extra } = trayWindow(labels);
  return (
    <div className="job-tray-slot">
      <div className="job-tray" aria-live="polite" aria-atomic="true" data-testid="job-tray">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("request.trayCount", { n: labels.length })}</p>
          <p className="flex min-w-0 items-baseline gap-1 text-sm">
            <span className="truncate">{shown.join(", ")}</span>
            {extra > 0 && <span className="shrink-0">{t("request.trayMore", { n: extra })}</span>}
          </p>
        </div>
        <button type="button" className="job-continue inline-flex min-h-touch shrink-0 items-center justify-center rounded-full px-5 font-semibold" onClick={onContinue}>
          {t("request.continue")}
        </button>
      </div>
    </div>
  );
}
