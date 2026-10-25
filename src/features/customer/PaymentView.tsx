import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { buildSchedule, splitDepositBalance, type PayMethod } from "@/core/rules";
import type { JobCtx } from "@/core/machines";
import { localeFor } from "@/i18n";
import { chargeCard, chargeWallet, DEMO_CARDS } from "@/mocks/payments/gateway";
import { confirmPayment, ensureReference, paymentState } from "@/mocks/runtime/paymentActors";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { HlDate } from "@/ui/Highlights";
import { useMoney } from "@/features/shared/Money";
import { PaymentSchedule, ReferenceBox } from "./PaymentSchedule";
import { JOB_ID } from "./session";

/** Deposit screen. Cards and wallets pay now; cash and SPEI get a reference with exact deadlines and consequences. */
export function PaymentView({ ctx, method, rt, onPaid }: { ctx: JobCtx; method: PayMethod; rt: DemoRuntime; onPaid: (amount: number) => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const lang = i18n.language as Lang;
  const [card, setCard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isCard = method === "card" || method === "wallet";
  const basis = ctx.scheduleBasis ?? rt.clock.now();
  const sch = buildSchedule({ method, total: ctx.total, jobStart: ctx.jobStart, now: basis });
  const first = sch.installments[0]!;
  const due = Math.max(ctx.initialDue - ctx.paid, 0);
  const { balance } = splitDepositBalance(ctx.total);

  useEffect(() => {
    if (!isCard && first.dueAt) ensureReference(rt, JOB_ID, first.kind, method as "cash" | "spei", first.amount, first.dueAt);
  });

  if (!isCard) {
    const kind = first.kind;
    const pstate = paymentState(rt, JOB_ID, kind);
    const id = `pay:${JOB_ID}:${kind}`;
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t("pay.title")}</h2>
        <p className="text-2xl font-bold">{t("pay.dueBy", { amount: money(first.amount), when: first.dueAt ? formatDateTime(first.dueAt, localeFor[lang]) : "" })}</p>
        <ReferenceBox method={method as "cash" | "spei"} id={id} />
        <PaymentSchedule method={method} total={ctx.total} jobStart={ctx.jobStart} basis={basis} />
        {pstate === "waitingReference" && (
          <>
            <p role="status"><HlDate>{t("pay.waiting")}</HlDate></p>
            <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
              <Button variant="secondary" onClick={() => { confirmPayment(rt, JOB_ID, kind); onPaid(first.amount); }}>{t("demo.simulatePayment")}</Button>
            </div>
          </>
        )}
        {pstate === "received" && <p role="status" className="font-bold">{t("pay.received")}</p>}
        {pstate === "expired" && <ErrorText>{t("payment.expiredBody")}</ErrorText>}
      </div>
    );
  }

  const pay = () => {
    const res = method === "wallet" ? chargeWallet(due) : chargeCard(card, due);
    if (res.ok) { setError(null); onPaid(due); } else setError(res.reason === "declined" ? "pay.declined" : "pay.invalid");
  };
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("pay.title")}</h2>
      <p className="text-3xl font-bold">{t("pay.amount", { amount: money(due) })}</p>
      <p className="text-inkSoft">{t("pay.balanceLater", { amount: money(balance) })}</p>
      {method === "card" && (
        <>
          <Field label={t("pay.cardNumber")}>
            <input className={inputClass} inputMode="numeric" autoComplete="cc-number" value={card} onChange={(e) => setCard(e.target.value)} />
          </Field>
          <p className="text-sm"><DemoValue>{t("pay.demoCards", { approved: DEMO_CARDS.approved, declined: DEMO_CARDS.declined })}</DemoValue></p>
        </>
      )}
      {error && <ErrorText>{t(error)}</ErrorText>}
      <Button onClick={pay}>{method === "wallet" ? t("btn.payWallet") : t("btn.payDeposit")}</Button>
    </div>
  );
}
