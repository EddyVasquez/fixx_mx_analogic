import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { buildSchedule, splitDepositBalance, type PayMethod } from "@/core/rules";
import type { JobCtx } from "@/core/machines";
import { localeFor } from "@/i18n";
import { chargeCardOnce, chargeWalletOnce, DEMO_CARDS } from "@/mocks/payments/gateway";
import { confirmPayment, issueReference, paymentState } from "@/mocks/runtime/paymentActors";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, focusTargetClass, inputClass } from "@/ui/Field";
import { HlDate } from "@/ui/Highlights";
import { actionTiming, createSingleFlight, paymentFailureKey, paymentIdempotencyKey, runTimed, sleep } from "./actionTiming";
import { formatCustomerMXN } from "./moneyFormat";
import { PaymentSchedule, ReferenceBox } from "./PaymentSchedule";
import { JOB_ID } from "./session";

type Phase = "idle" | "processing" | "success" | "failed";
type RefPhase = "idle" | "processing" | "ready" | "failed";
type PayError = "pay.declined" | "pay.invalid" | "pay.network" | "pay.unknown" | "pay.refFailed";

/** Deposit screen. Cards and wallets pay now; cash and SPEI get a reference with exact deadlines and consequences. */
export function PaymentView({ ctx, method, rt, onPaid }: { ctx: JobCtx; method: PayMethod; rt: DemoRuntime; onPaid: (amount: number) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [card, setCard] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorKey, setErrorKey] = useState<PayError | null>(null);
  const [slow, setSlow] = useState(false);
  const [refPhase, setRefPhase] = useState<RefPhase>("idle");
  const [refError, setRefError] = useState(false);
  const [refSlow, setRefSlow] = useState(false);
  const cardRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const refErrorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const receivedRef = useRef<HTMLParagraphElement>(null);
  const paidOnce = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const once = useRef(createSingleFlight());
  const refOnce = useRef(createSingleFlight());
  const isCard = method === "card" || method === "wallet";
  const basis = ctx.scheduleBasis ?? rt.clock.now();
  const sch = buildSchedule({ method, total: ctx.total, jobStart: ctx.jobStart, now: basis });
  const first = sch.installments[0]!;
  const due = Math.max(ctx.initialDue - ctx.paid, 0);
  const { balance } = splitDepositBalance(ctx.total);
  const amount = formatCustomerMXN(due);
  const payKey = paymentIdempotencyKey(JOB_ID, first.kind);
  const dueAtMs = first.dueAt?.getTime() ?? null;
  const fieldFault = errorKey === "pay.invalid" || errorKey === "pay.declined";
  const receivedOnce = useRef(false);

  const createReference = () => {
    if (!first.dueAt) return Promise.resolve();
    const dueAt = first.dueAt;
    const kind = first.kind;
    const payMethod = method as "cash" | "spei";
    const amountDue = first.amount;
    return refOnce.current(async () => {
      setRefPhase("processing");
      setRefError(false);
      setRefSlow(false);
      const timed = await runTimed(
        async () => {
          await sleep(actionTiming.latencyMs);
          return issueReference(rt, JOB_ID, kind, payMethod, amountDue, dueAt);
        },
        () => setRefSlow(true)
      );
      if (!timed.ok || !timed.value.ok) {
        setRefPhase("failed");
        setRefError(true);
        return;
      }
      setRefPhase("ready");
      setRefSlow(false);
    });
  };

  useEffect(() => {
    if (isCard || dueAtMs == null) return;
    if (paymentState(rt, JOB_ID, first.kind)) { setRefPhase("ready"); return; }
    createReference();
    // Retry goes through the button. The timestamp, not the Date object, keeps this from running every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCard, method, first.kind, dueAtMs]);

  useEffect(() => {
    if (phase !== "failed" || !errorKey) return;
    if (fieldFault) cardRef.current?.focus();
    else errorRef.current?.focus();
  }, [phase, errorKey, fieldFault]);

  useEffect(() => {
    if (refError) refErrorRef.current?.focus();
  }, [refError]);

  useEffect(() => {
    if (phase !== "success") return;
    successRef.current?.focus();
    const id = window.setTimeout(() => {
      if (paidOnce.current) return;
      paidOnce.current = true;
      onPaidRef.current(due);
    }, actionTiming.successPauseMs);
    return () => window.clearTimeout(id);
  }, [phase, due]);

  const pstate = paymentState(rt, JOB_ID, first.kind);
  useEffect(() => {
    if (pstate === "received") receivedRef.current?.focus();
  }, [pstate]);

  const pay = () => once.current(async () => {
    if (phase === "success") return;
    setPhase("processing");
    setErrorKey(null);
    setSlow(false);
    const timed = await runTimed(
      () => method === "wallet" ? chargeWalletOnce(due, payKey, () => sleep(actionTiming.latencyMs)) : chargeCardOnce(card, due, payKey, () => sleep(actionTiming.latencyMs)),
      () => setSlow(true)
    );
    if (!timed.ok) {
      setPhase("failed");
      setErrorKey(paymentFailureKey("timeout"));
      setSlow(false);
      return;
    }
    if (timed.value.ok) {
      setPhase("success");
      setSlow(false);
      return;
    }
    setPhase("failed");
    setErrorKey(paymentFailureKey(timed.value.reason));
    setSlow(false);
  });

  const markReceived = () => {
    if (receivedOnce.current) return;
    receivedOnce.current = true;
    confirmPayment(rt, JOB_ID, first.kind);
    window.setTimeout(() => onPaidRef.current(first.amount), actionTiming.successPauseMs);
  };

  if (!isCard) {
    const id = payKey;
    const when = first.dueAt ? formatDateTime(first.dueAt, localeFor[lang]) : "";
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t("pay.title")}</h2>
        <p className="text-2xl font-bold">{t("pay.dueBy", { amount: formatCustomerMXN(first.amount), when })}</p>
        <div role="status" aria-live="polite" className="flex flex-col gap-1 font-semibold">
          {refPhase === "processing" && <p>{t("pay.refCreating")}</p>}
          {refSlow && refPhase === "processing" && <p>{t("common.slow")}</p>}
        </div>
        {refError && <ErrorText ref={refErrorRef} id="pay-ref-error">{t("pay.refFailed")}</ErrorText>}
        {refPhase === "failed" && <Button className="w-full" onClick={() => createReference()}>{t("btn.tryAgain")}</Button>}
        {refPhase === "processing" && <Button className="w-full" loading>{t("btn.processing")}</Button>}
        {refPhase === "ready" && (
          <>
            <ReferenceBox method={method as "cash" | "spei"} id={id} />
            <PaymentSchedule method={method} total={ctx.total} jobStart={ctx.jobStart} basis={basis} formatAmount={formatCustomerMXN} />
            {pstate === "waitingReference" && (
              <>
                <p role="status"><HlDate>{t("pay.waiting")}</HlDate></p>
                <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
                  <Button variant="secondary" onClick={markReceived}>{t("demo.simulatePayment")}</Button>
                </div>
              </>
            )}
            {pstate === "received" && <p ref={receivedRef} tabIndex={-1} role="status" className={`font-bold ${focusTargetClass}`}>{t("pay.received")}</p>}
            {pstate === "expired" && <ErrorText>{t("payment.expiredBody")}</ErrorText>}
          </>
        )}
      </div>
    );
  }

  const buttonLabel = phase === "processing" ? t("btn.processing") : phase === "failed" ? t("btn.tryAgain") : method === "wallet" ? t("btn.payWallet") : t("btn.payDeposit");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("pay.title")}</h2>
      <p className="text-3xl font-bold">{t("pay.amount", { amount })}</p>
      <p className="text-inkSoft">{t("pay.balanceLater", { amount: formatCustomerMXN(balance) })}</p>
      {method === "card" && (
        <>
          <Field label={t("pay.cardNumber")}>
            <input
              ref={cardRef}
              id="pay-card"
              className={inputClass}
              inputMode="numeric"
              autoComplete="cc-number"
              value={card}
              readOnly={phase === "processing" || phase === "success"}
              aria-invalid={fieldFault || undefined}
              aria-describedby={errorKey ? "pay-error" : undefined}
              onChange={(e) => setCard(e.target.value)}
            />
          </Field>
          <p className="text-sm"><DemoValue>{t("pay.demoCards", { approved: DEMO_CARDS.approved, declined: DEMO_CARDS.declined, network: DEMO_CARDS.network, unknown: DEMO_CARDS.unknown })}</DemoValue></p>
        </>
      )}
      <div role="status" aria-live="polite" className="flex flex-col gap-1 font-semibold">
        {phase === "processing" && <p>{t("pay.processing")}</p>}
        {slow && phase === "processing" && <p>{t("common.slow")}</p>}
        {phase === "success" && <p ref={successRef} tabIndex={-1} className={`text-2xl font-bold ${focusTargetClass}`}>{t("pay.success", { amount })}</p>}
      </div>
      {errorKey && <ErrorText ref={errorRef} id="pay-error">{t(errorKey)}</ErrorText>}
      {phase !== "success" && (
        <Button className="w-full" loading={phase === "processing"} onClick={() => pay()}>{buttonLabel}</Button>
      )}
    </div>
  );
}
