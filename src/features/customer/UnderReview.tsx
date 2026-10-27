import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { JobCtx } from "@/core/machines";
import { localeFor } from "@/i18n";
import { DemoValue } from "@/ui/DemoBadge";
import { HlDate } from "@/ui/Highlights";
import { useMoney } from "@/features/shared/Money";

/** Shown once a problem is reported. Only the reported amount stays held. */
export function UnderReview({ ctx, lang, role }: { ctx: JobCtx; lang: Lang; role: "customer" | "professional" }) {
  const { t } = useTranslation();
  const money = useMoney();
  const when = ctx.returnVisitBy ? formatDateTime(ctx.returnVisitBy, localeFor[lang]) : "";
  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("review.fixx.title")}</h3>
      {ctx.returnVisitBy && (
        <p>
          <DemoValue><HlDate>{t("review.fixx.body", { when })}</HlDate></DemoValue>
        </p>
      )}
      {role === "customer" ? (
        <>
          <p className="font-bold">{t("review.fixx.released", { amount: money(ctx.releasedAmount) })}</p>
          <p className="font-bold">{t("review.fixx.held", { amount: money(ctx.heldAmount) })}</p>
        </>
      ) : (
        <>
          <p className="font-bold">{t("work.releasedShare", { amount: money(ctx.releasedPayout) })}</p>
          <p className="font-bold">{t("work.heldShare", { amount: money(ctx.heldPayout) })}</p>
        </>
      )}
    </section>
  );
}
