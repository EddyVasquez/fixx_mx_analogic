import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Always-visible marker that everything is simulated. */
export function DemoBadge() {
  const { t } = useTranslation();
  return (
    <span role="note" aria-label={t("demo.badgeHint")} title={t("demo.badgeHint")}
      className="inline-flex items-center rounded-full bg-warnBg px-3 py-1 text-sm font-semibold text-warnInk border border-warnInk/30">
      {t("demo.badge")}
    </span>
  );
}

/** Marks any config-driven number that is a demo default, not a decision. */
export function DemoValue({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <span>
      {children}{" "}
      <span className="rounded bg-warnBg px-1.5 text-xs font-semibold text-warnInk">{t("demo.value")}</span>
    </span>
  );
}
