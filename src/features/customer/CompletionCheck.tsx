import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { customerBalance, customerDeposit, hoursUntil } from "@/core/rules";
import type { JobCtx } from "@/core/machines";
import { localeFor } from "@/i18n";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { HlDate } from "@/ui/Highlights";
import { useMoney } from "@/features/shared/Money";
import { CompletionChecklist } from "@/features/shared/CompletionChecklist";
import { JobPhotos } from "@/features/shared/JobPhotos";
import { session } from "./session";

/** Customer check of the finished job. The list is optional. Approve releases the balance. */
export function CompletionCheck({ ctx, categoryId, now, lang, onApprove, onToggle }: {
  ctx: JobCtx; categoryId: string; now: Date; lang: Lang; onApprove: () => void; onToggle: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const open = !!ctx.issueWindowEndsAt && now.getTime() <= ctx.issueWindowEndsAt.getTime();
  const hours = ctx.issueWindowEndsAt ? hoursUntil(ctx.issueWindowEndsAt, now) : 0;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("completion.title")}</h3>
      <p>{t("completion.intro")}</p>
      <JobPhotos phase="after" label={t("completion.photos")} now={now} lang={lang} readOnly />
      <CompletionChecklist
        categoryId={categoryId}
        checks={session.completionChecks}
        onToggle={(id, checked) => { session.completionChecks = { ...session.completionChecks, [id]: checked }; onToggle(); }}
        optionalNote={t("completion.checklistNote")}
      />
      <p className="font-semibold">{t("completion.deposit", { amount: money(customerDeposit(ctx.total)) })}</p>
      <p className="text-xl font-bold">{t("completion.balance", { amount: money(customerBalance(ctx.total)) })}</p>
      {ctx.issueWindowEndsAt && (
        <p aria-live="polite">
          <DemoValue>
            <HlDate>{t("completion.countdown", { when: formatDateTime(ctx.issueWindowEndsAt, localeFor[lang]), hours })}</HlDate>
          </DemoValue>
        </p>
      )}
      <p className="text-sm text-inkSoft">{t("completion.demoPay")}</p>
      {open && <Button onClick={onApprove}>{t("btn.approveJob")}</Button>}
    </section>
  );
}
