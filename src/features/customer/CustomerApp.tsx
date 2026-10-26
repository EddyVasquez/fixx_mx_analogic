import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { config } from "@/core/config/fixx.config";
import { recommend } from "@/core/matching/recommend";
import { buildQuote, humanReviewForCategory } from "@/core/pricing/quote";
import { bandFor, manualReviewFollowUp, travelFeeFor } from "@/core/rules";
import { formatDateTime } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import { HlDate } from "@/ui/Highlights";
import { jobMachine, newJobCtx, statusFor, type JobCtx, type JobState } from "@/core/machines";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { Button } from "@/ui/Button";
import { runtime, useRuntime } from "@/demo/runtime";
import { SignIn } from "./SignIn";
import { Home } from "./Home";
import { RequestBuilder, RequestReview } from "./RequestBuilder";
import { EstimateView } from "./Estimate";
import { Recommendations } from "./Recommendations";
import { ProSimulator } from "./ProSimulator";
import { QuoteView } from "./QuoteView";
import { PaymentView } from "./PaymentView";
import { RefundView } from "./RefundView";
import { CancelSection } from "./CancelSection";
import { ChoiceView } from "./ChoiceView";
import { CaseCard } from "./CaseCard";
import { MyHomeTab } from "./MyHomeTab";
import { WarrantyTab } from "./WarrantyTab";
import { stateLabel } from "@/features/admin/sections";
import { SupportChatView } from "@/features/support/SupportChatView";
import { TimelineView } from "./TimelineView";
import { RatingView } from "./RatingView";
import { customers, professionals, zones } from "./data";
import { ChatView } from "@/features/chat/ChatView";
import { JOB_ID, ratings, resetSession, session, type Draft } from "./session";

type Pre = "home" | "request" | "review";
const BRANCH: JobState[] = ["cancelled", "professionalCancelled", "noShow", "rescheduleUnanswered", "bookingExpired", "refunded"];

/** Customer flow. Before a request exists the screens are local steps; after that the job's state decides the screen. */
function RequestFlow() {
  const { t, i18n } = useTranslation();
  const rt = useRuntime();
  const lang = i18n.language as Lang;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [pre, setPre] = useState<Pre>("home");
  const update = (p: Partial<typeof session>) => { Object.assign(session, p); force(); };
  const setDraft = (p: Partial<Draft>) => update({ draft: { ...session.draft, ...p } });
  const startOver = () => { rt.reset(); resetSession(); setPre("home"); force(); };

  const draft = session.draft;
  const job = rt.get(JOB_ID);
  const state = job?.snap.state as JobState | undefined;
  const ctx = job?.snap.ctx as JobCtx | undefined;
  const customer = customers.find((c) => c.language === lang) ?? customers[0];
  const pro = professionals.find((p) => p.id === session.proId);
  // The customer's messages arrive in the language they are using the app in.
  useEffect(() => { rt.languages.customer = lang; });
  const send = (event: { type: string } & Record<string, unknown>) => rt.dispatch(JOB_ID, event);

  if (!session.signedIn) return <SignIn onDone={(email) => update({ signedIn: true, email })} />;

  if (!job || !state || !ctx) {
    if (pre === "request") return <RequestBuilder draft={draft} onChange={setDraft} onReview={() => setPre("review")} />;
    if (pre === "review") {
      return <RequestReview draft={draft} onEdit={() => setPre("request")} onSubmit={() => {
        rt.languages.customer = lang;
        rt.spawn(JOB_ID, "job", jobMachine, newJobCtx({ needsReview: humanReviewForCategory(draft.categoryId).length > 0 }), { categoryId: draft.categoryId });
        send({ type: draft.zoneId === "outside" ? "OUT_OF_AREA" : "ESTIMATE_READY" });
        force();
      }} />;
    }
    return <Home name={customer?.name ?? ""} email={session.email}
      onPick={(id) => { setDraft({ categoryId: id, emergency: false }); setPre("request"); }}
      onUrgent={() => { setDraft({ emergency: true }); setPre("request"); }} />;
  }

  const quote = buildQuote(draft.categoryId, draft.emergency);
  const proEvent = (type: string) => {
    if (type === "SEND_QUOTE" && pro) {
      const fee = travelFeeFor(bandFor(pro.zoneId, draft.zoneId, zones));
      send({ type, total: quote.total, travelFee: fee, payoutRatio: config.demoPayoutRatio, lines: quote.lines });
    } else send({ type });
  };

  const branchView = (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl border-2 border-ink p-3 font-bold">{t(`state.${state}`)}</p>
      {state === "bookingExpired" && <p>{t("payment.expiredBody")}</p>}
      {state === "cancelled" && <p>{t("cancel.noRefundBody")}</p>}
      <Button onClick={startOver}>{t("btn.startOver")}</Button>
    </div>
  );

  switch (state) {
    case "manualReview":
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">{t("manual.title")}</h2>
          <p>{t("manual.body", { hours: config.outOfAreaFollowUpHours })}</p>
          <p><HlDate>{t("manual.followUpBy", { when: formatDateTime(manualReviewFollowUp(new Date(job.snap.history[0]?.at ?? rt.clock.now().toISOString())), localeFor[lang]) })}</HlDate></p>
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
            <p className="text-sm font-semibold">{t("demo.adminActing")}</p>
            <Button variant="secondary" onClick={() => send({ type: "MANUAL_REVIEW_APPROVED" })}>{t("demo.approveAddress")}</Button>
            <Button variant="secondary" onClick={() => send({ type: "MANUAL_REVIEW_DECLINED" })}>{t("demo.declineAddress")}</Button>
          </div>
        </div>
      );
    case "estimated":
      return <EstimateView draft={draft} onNext={() => send({ type: "RECOMMENDATIONS_READY" })} />;
    case "recommendations": {
      const recs = recommend({ categoryId: draft.categoryId, customerZoneId: draft.zoneId === "outside" ? null : draft.zoneId, customerLang: lang, professionals: professionals.filter((p) => !session.excluded.includes(p.id)), zones });
      return <Recommendations recs={recs} onChoose={(id) => {
        const p = professionals.find((x) => x.id === id);
        rt.languages.professional = (p?.languages[0] ?? "es") as Lang;
        update({ proId: id });
        send({ type: "SELECT_PROFESSIONAL", professionalId: id });
      }} />;
    }
    case "professionalSelected":
      return (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">{t("wait.title")}</h2>
          <p>{t("wait.body", { name: pro?.name ?? "" })}</p>
          <ProSimulator state={state} onEvent={proEvent} />
          <ChatView jobId={JOB_ID} role="customer" />
        </div>
      );
    case "pendingReview":
    case "quoteSent":
      return <QuoteView ctx={ctx} draft={draft} professionalName={pro?.name ?? ""} now={rt.clock.now()}
        awaitingApproval={state === "pendingReview"}
        slotHours={session.slotHours} method={session.method} onSlot={(h) => update({ slotHours: h })} onMethod={(m) => update({ method: m })}
        onAccept={(jobStart) => send({ type: "ACCEPT_QUOTE", method: session.method, jobStart })} />;
    case "awaitingDeposit":
      return (
        <div className="flex flex-col gap-4">
          <PaymentView ctx={ctx} method={session.method} rt={rt} onPaid={(amount) => send({ type: "PAYMENT_SATISFIED", amount })} />
          <CancelSection state={state} ctx={ctx} onCancel={() => send({ type: "CUSTOMER_CANCELS" })} />
        </div>
      );
    case "paymentReleased":
    case "rated": {
      const w = rt.get(`warranty:${JOB_ID}`)?.snap.ctx as { endsAt: Date } | undefined;
      const refund = rt.refunds.find((r) => r.actorId === JOB_ID);
      const status = statusFor(state);
      return (
        <div className="flex flex-col gap-4">
          {status && <JobStatusBar status={status} />}
          <RatingView rated={state === "rated"} warrantyEndsAt={w?.endsAt ?? null} onSubmit={(values) => { ratings.push({ proId: session.proId ?? "", values }); send({ type: "RATE" }); }} />
          <Button variant="secondary" onClick={startOver}>{t("btn.startOver")}</Button>
          <CaseCard rt={rt} jobId={JOB_ID} role="customer" lang={lang} />
          {refund && <RefundView refund={refund} issued hideStartOver onStartOver={startOver} onAuto={() => {}} onClabe={(c) => rt.provideClabe(refund.id, c)} />}
        </div>
      );
    }
    case "professionalCancelled":
    case "noShow":
    case "rescheduleUnanswered":
      return <ChoiceView state={state} paid={ctx.paid}
        onReplace={() => { update({ excluded: [...session.excluded, ...(session.proId ? [session.proId] : [])], proId: null }); send({ type: "CHOOSE_REPLACEMENT" }); }}
        onRefund={() => send({ type: "CHOOSE_REFUND" })} />;
    case "cancelled":
    case "refunded": {
      const refund = rt.refunds.find((r) => r.actorId === JOB_ID);
      if (refund) {
        return <RefundView refund={refund} issued={state === "refunded"} onStartOver={startOver}
          onClabe={(c) => { const ok = rt.provideClabe(refund.id, c); if (ok) send({ type: "REFUND_ISSUED" }); return ok; }}
          onAuto={() => { send({ type: "REFUND_ISSUED" }); }} />;
      }
      return branchView;
    }
    default:
      if (BRANCH.includes(state)) return branchView;
      return <TimelineView state={state} ctx={ctx} onEvent={proEvent} onSend={send} />;
  }
}

const TAB_KEYS = { request: "customer.tab.request", home: "customer.tab.myHome", warranty: "customer.tab.warranty", help: "customer.tab.help" } as const;

/** Customer app: sign-in, then three tabs (request flow, My Home, Warranty). */
export function CustomerApp() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const rt = useRuntime();
  const jobState = rt.get(JOB_ID)?.snap.state;
  if (!session.signedIn) return <SignIn onDone={(email) => { session.signedIn = true; session.email = email; force(); }} />;
  return (
    <div className="flex flex-col gap-4">
      {/* Announces job status changes to screen readers */}
      <p role="status" className="sr-only">{jobState ? `${t("status.label")}: ${stateLabel(t, jobState)}` : ""}</p>
      <div role="group" className="flex gap-2">
        {(Object.keys(TAB_KEYS) as (keyof typeof TAB_KEYS)[]).map((tab) => (
          <button key={tab} type="button" aria-pressed={session.tab === tab} onClick={() => { session.tab = tab; force(); }}
            className={`min-h-touch flex-1 rounded-full border-2 border-ink px-2 text-sm font-semibold ${session.tab === tab ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
            {t(TAB_KEYS[tab])}
          </button>
        ))}
      </div>
      {session.tab === "request" && <RequestFlow />}
      {session.tab === "home" && <MyHomeTab lang={lang} />}
      {session.tab === "warranty" && <WarrantyTab lang={lang} />}
      {session.tab === "help" && <SupportChatView lang={lang} />}
    </div>
  );
}
