import { useState } from "react";
import { useTranslation } from "react-i18next";
import { customerCancellation } from "@/core/rules";
import type { JobCtx, JobState } from "@/core/machines";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { useMoney } from "@/features/shared/Money";

/** Customer cancellation with the consequences spelled out first: free before "on the way", travel fee after. */
export function CancelSection({ state, ctx, onCancel }: { state: JobState; ctx: JobCtx; onCancel: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const after = state === "onTheWay";
  const o = customerCancellation({ stage: after ? "afterOnTheWay" : "beforeOnTheWay", paid: ctx.paid, travelFee: ctx.travelFee });
  const fee = money(o.travelFeeCharged), refund = money(o.refund);

  let body: string;
  if (!after) body = ctx.paid > 0 ? t("cancel.beforePaid", { refund }) : t("cancel.beforeFree");
  else if (ctx.paid === 0) body = t("cancel.afterNothing");
  else body = o.noRefund ? t("cancel.afterNoRefund", { fee }) : t("cancel.afterRefund", { fee, refund });

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>{t("btn.cancelJob")}</Button>;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("cancel.title")}</h3>
      <p>{after && ctx.paid > 0 ? <DemoValue>{body}</DemoValue> : body}</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>{t("btn.keepJob")}</Button>
        <Button className="flex-1" onClick={onCancel}>{t("btn.confirmCancel")}</Button>
      </div>
    </section>
  );
}
