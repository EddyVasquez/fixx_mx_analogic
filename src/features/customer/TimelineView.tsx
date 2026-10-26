import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { buildSchedule, splitDepositBalance } from "@/core/rules";
import { statusFor, type JobCtx, type JobState } from "@/core/machines";
import { localeFor } from "@/i18n";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { useMoney } from "@/features/shared/Money";
import { NotificationCenterView } from "@/demo/NotificationCenterView";
import { HlDate } from "@/ui/Highlights";
import { Button } from "@/ui/Button";
import { useRuntime } from "@/demo/runtime";
import { confirmPayment, ensureReference } from "@/mocks/runtime/paymentActors";
import { PaymentSchedule, ReferenceBox } from "./PaymentSchedule";
import { AdditionalApproval, AdditionalPayment } from "./AdditionalWork";
import { CancelSection } from "./CancelSection";
import { RescheduleSection } from "./RescheduleSection";
import { ChatView } from "@/features/chat/ChatView";
import { ProSimulator } from "./ProSimulator";
import { CaseCard } from "./CaseCard";
import { CaseAgentDemo } from "./AgentDemo";
import { IssueReport } from "./IssueReport";
import { CloseWindowAction } from "./CloseWindowAction";
import { JOB_ID, session } from "./session";

export function TimelineView({ state, ctx, onEvent, onSend }: { state: JobState; ctx: JobCtx; onEvent: (type: string) => void; onSend?: (e: { type: string } & Record<string, unknown>) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const money = useMoney();
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const status = statusFor(state);
  const cardLike = ctx.method === "card" || ctx.method === "wallet";
  const rt = useRuntime();
  const basis = ctx.scheduleBasis ?? rt.clock.now();
  // Cash and SPEI: the balance is paid by reference before the job (when it is not already covered).
  const balanceDue = !cardLike && state === "scheduled" && !ctx.balancePaid
    ? buildSchedule({ method: ctx.method, total: ctx.total, jobStart: ctx.jobStart, now: basis }).installments.find((i) => i.kind === "balance")
    : undefined;
  useEffect(() => { if (balanceDue?.dueAt) ensureReference(rt, JOB_ID, "balance", ctx.method as "cash" | "spei", balanceDue.amount, balanceDue.dueAt); });

  // Cards and wallets: the balance is charged when the professional marks the job complete.
  useEffect(() => { if (state === "markedComplete" && cardLike) onEvent("BALANCE_PAID"); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("timeline.title")}</h2>
      {status && <JobStatusBar status={status} />}
      <p><HlDate>{t("timeline.when", { when: when(ctx.jobStart) })}</HlDate></p>
      {state === "issueWindow" && ctx.issueWindowEndsAt && (
        <>
          {cardLike && <p>{t("timeline.balanceCharged", { amount: money(Math.round((ctx.total - ctx.paid) * 100) / 100) })}</p>}
          <p><HlDate>{t("timeline.windowEnds", { when: when(ctx.issueWindowEndsAt) })}</HlDate></p>
          <p className="text-inkSoft">{t("rating.pending")}</p>
          <CloseWindowAction rt={rt} jobId={JOB_ID} />
        </>
      )}
      {state === "markedComplete" && !ctx.balancePaid && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
          <p className="text-sm font-semibold">{t("demo.proActing")}</p>
          <Button variant="secondary" onClick={() => onEvent("BALANCE_PAID")}>{t("demo.simulatePayment")}</Button>
        </div>
      )}
      {state === "issueWindow" && onSend && (
        <IssueReport ctx={ctx} onSubmit={(selected, description) => { session.issueNote = description; onSend({ type: "REPORT_ISSUE", selected }); }} />
      )}
      {state === "issueOpen" && (
        <>
          <CaseCard rt={rt} jobId={JOB_ID} role="customer" lang={lang} />
          <CaseAgentDemo rt={rt} jobId={JOB_ID} />
        </>
      )}
      {balanceDue && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
          <h3 className="text-lg font-bold">{t("balance.title")}</h3>
          <ReferenceBox method={ctx.method as "cash" | "spei"} id={`pay:${JOB_ID}:balance`} />
          <PaymentSchedule method={ctx.method} total={ctx.total} jobStart={ctx.jobStart} basis={basis} only="balance" />
          <div className="rounded-2xl border-2 border-dashed border-ink p-3">
            <Button variant="secondary" onClick={() => { confirmPayment(rt, JOB_ID, "balance"); onEvent("BALANCE_PAID"); }}>{t("demo.simulatePayment")}</Button>
          </div>
        </section>
      )}
      {state === "additionalWorkPending" && <AdditionalApproval ctx={ctx} viewerLang={lang} onApprove={() => onEvent("APPROVE_ADDITIONAL_WORK")} onDecline={() => onEvent("DECLINE_ADDITIONAL_WORK")} />}
      {(state === "inProgress" || state === "checklistComplete") && <AdditionalPayment rt={rt} ctx={ctx} onPaid={() => onEvent("ADDITIONAL_WORK_PAID")} />}
      {state === "scheduled" && <RescheduleSection rt={rt} lang={lang} />}
      {(state === "scheduled" || state === "onTheWay") && <CancelSection state={state} ctx={ctx} onCancel={() => onEvent("CUSTOMER_CANCELS")} />}
      <ProSimulator state={state} onEvent={onEvent} />
      <ChatView jobId={JOB_ID} role="customer" />
      <NotificationCenterView audience="customer" channel="inApp" />
    </div>
  );
}
