import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { CaseCtx, CaseState } from "@/core/machines";
import { localeFor } from "@/i18n";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { HlDate } from "@/ui/Highlights";
import { useMoney } from "@/features/shared/Money";

/** Case status for one side. Customers see the held amount; professionals see only their net held share. */
export function CaseCard({ rt, jobId, role, lang }: { rt: DemoRuntime; jobId: string; role: "customer" | "professional"; lang: Lang }) {
  const { t } = useTranslation();
  const money = useMoney();
  const a = rt.get(`case:${jobId}`);
  if (!a) return null;
  const c = a.snap.ctx as CaseCtx;
  const st = a.snap.state as CaseState;
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const used = c.reviewsUsed.includes(role);
  const canAsk = st === "decided" && !used && !!c.reviewBy && rt.clock.now().getTime() <= c.reviewBy.getTime();

  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("case.title")}</h3>
      <p className="font-semibold">{t(`case.status.${st}`)}</p>
      <p>{role === "customer" ? t("case.held", { amount: money(c.heldAmount) }) : t("case.heldShare", { amount: money(c.heldPayout) })}</p>
      {st !== "final" && <p className="text-sm">{t("case.resolveBy", { days: config.caseResolutionBusinessDays, when: when(c.resolveBy) })}</p>}
      {c.decision && <p className="font-semibold">{t(`case.decision.${c.decision}`)}</p>}
      {st === "decided" && c.reviewBy && <p><HlDate>{t("case.reviewDeadline", { when: when(c.reviewBy) })}</HlDate></p>}
      {st === "decided" && used && <p className="text-sm">{t("case.reviewUsed")}</p>}
      {canAsk && <Button variant="secondary" onClick={() => rt.dispatch(a.id, { type: "REQUEST_REVIEW", by: role })}>{t("btn.askReview")}</Button>}
      {st === "final" && <p className="font-bold">{t("case.final")}</p>}
    </section>
  );
}
