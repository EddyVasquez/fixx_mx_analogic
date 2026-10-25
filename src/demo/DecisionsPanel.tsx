import { useTranslation } from "react-i18next";
import { config } from "@/core/config/fixx.config";
import { useMoney } from "@/features/shared/Money";
import { DemoValue } from "@/ui/DemoBadge";

/** The demo defaults for every undecided item. Nothing here is a decision. The professional payout share is deliberately not listed. */
export function DecisionsPanel() {
  const { t } = useTranslation();
  const money = useMoney();
  const w = Object.values(config.warrantyDaysByCategory);
  const b = config.travelFeeBandsMXN;
  const est = config.estimateRangesMXN["painting"] ?? [0, 0];
  const items = [
    t("decisions.surcharge", { value: money(config.emergencySurchargeMXN) }),
    t("decisions.travel", { same: money(b.same), adjacent: money(b.adjacent), far: money(b.far) }),
    t("decisions.limits", { pct: config.professionalPriceLimitPct }),
    t("decisions.warranty", { min: Math.min(...w), max: Math.max(...w) }),
    t("decisions.hours", { start: config.businessHours.start, end: config.businessHours.end }),
    t("decisions.signIn", { valid: config.signIn.codeValiditySec / 60, resend: config.signIn.resendSec, lockout: config.signIn.lockoutSec / 60 }),
    t("decisions.caseReview", { days: config.caseReviewDeadlineDays }),
    t("decisions.estimate", { low: money(est[0]), high: money(est[1]) })
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-inkSoft">{t("decisions.intro")}</p>
      <ul className="flex flex-col gap-2 text-sm">{items.map((x) => <li key={x}><DemoValue>{x}</DemoValue></li>)}</ul>
    </div>
  );
}
