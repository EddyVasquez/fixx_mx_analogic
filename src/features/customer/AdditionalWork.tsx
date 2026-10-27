import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import type { JobCtx } from "@/core/machines";
import { confirmPayment, ensureReference } from "@/mocks/runtime/paymentActors";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { EXTRA_COPPER_LINE } from "@/core/pricing/extraCopper";
import { useMoney } from "@/features/shared/Money";
import { TranslatedText } from "@/features/shared/TranslatedText";
import { PaymentSchedule, ReferenceBox } from "./PaymentSchedule";
import { JOB_ID, session } from "./session";

/** The customer approves additional work before it starts. Cards: added to the balance. Cash/SPEI: a reference, no separate deposit. */
export function AdditionalApproval({ ctx, viewerLang, onApprove, onDecline }: { ctx: JobCtx; viewerLang: Lang; onApprove: () => void; onDecline: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const card = ctx.method === "card" || ctx.method === "wallet";
  const copper = ctx.additional?.lineId === EXTRA_COPPER_LINE;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("addl.approve.title")}</h3>
      {copper
        ? <p>{t("quote.line.extraCopper")}</p>
        : <p><TranslatedText text={session.additionalNote} from={session.additionalLang} to={viewerLang} /></p>}
      {copper && <p>{t("addl.copper.note", { meters: ctx.additional?.meters ?? 0 })}</p>}
      <p className="text-xl font-bold">{t("addl.amount", { amount: money(ctx.additional?.amount ?? 0) })}</p>
      <p>{card ? t("addl.card") : t("addl.cash")}</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onDecline}>{t("btn.declineAddl")}</Button>
        <Button className="flex-1" onClick={onApprove}>{t("btn.approveAddl")}</Button>
      </div>
    </section>
  );
}

/** Cash/SPEI only: the reference for approved additional work, which must be paid before the job can be marked complete. */
export function AdditionalPayment({ rt, ctx, onPaid }: { rt: DemoRuntime; ctx: JobCtx; onPaid: () => void }) {
  const { t } = useTranslation();
  const need = ctx.additional?.status === "approved" && ctx.additional.blocks && !ctx.additional.paid;
  useEffect(() => { if (need && ctx.additional) ensureReference(rt, JOB_ID, "additional", ctx.method as "cash" | "spei", ctx.additional.amount, null); });
  if (!need || !ctx.additional) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h3 className="text-lg font-bold">{t("addl.payTitle")}</h3>
      <ReferenceBox method={ctx.method as "cash" | "spei"} id={`pay:${JOB_ID}:additional`} />
      <p role="status" className="font-semibold">{t("pay.waiting")}</p>
      <div className="rounded-2xl border-2 border-dashed border-ink p-3">
        <Button variant="secondary" onClick={() => { confirmPayment(rt, JOB_ID, "additional"); onPaid(); }}>{t("demo.simulatePayment")}</Button>
      </div>
    </section>
  );
}
