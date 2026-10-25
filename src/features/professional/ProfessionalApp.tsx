import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { jobMachine, verificationMachine, newVerification, statusFor, type JobCtx, type JobState, type VerificationCtx, type VerificationState } from "@/core/machines";
import { round2 } from "@/core/rules";
import { runtime, useRuntime } from "@/demo/runtime";
import { Button } from "@/ui/Button";
import { inputClass } from "@/ui/Field";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { useMoney } from "@/features/shared/Money";
import { ChatView } from "@/features/chat/ChatView";
import { professionals } from "@/features/customer/data";
import { JOB_ID, session } from "@/features/customer/session";
import { SupportChatView } from "@/features/support/SupportChatView";
import { Onboarding } from "./Onboarding";
import { JobRequest } from "./JobRequest";
import { JobWork } from "./JobWork";
import { ProfileTab } from "./ProfileTab";
import { ScheduleTab } from "./ScheduleTab";
import { psession } from "./session";

const NEW = "new";
const BRANCH: JobState[] = ["cancelled", "professionalCancelled", "noShow", "rescheduleUnanswered", "bookingExpired", "refunded"];
const TABS = ["jobs", "schedule", "profile", "help"] as const;

export function ProfessionalApp() {
  const { t, i18n } = useTranslation();
  const rt = useRuntime();
  const money = useMoney();
  const lang = i18n.language as Lang;
  const [, force] = useReducer((x: number) => x + 1, 0);

  const meId = psession.meId ?? session.proId ?? "p6";
  const me = professionals.find((p) => p.id === meId);
  const vid = `verify:${meId}`;

  // The professional's messages arrive in the language they are using the app in.
  useEffect(() => { rt.languages.professional = lang; });
  // Seeded professionals start verified (or pending); "new" starts from scratch.
  useEffect(() => {
    if (rt.get(vid)) return;
    const approved = me?.verification === "approved";
    const ctx: VerificationCtx = approved ? { idDoc: true, selfie: true, phoneVerified: true, reason: null, recovery: false } : newVerification();
    rt.spawn(vid, "verification", verificationMachine, ctx, {}, me ? (approved ? "approved" : "pending") : undefined);
  });

  const v = rt.get(vid);
  const vstate = v?.snap.state as VerificationState | undefined;
  const sendV = (e: { type: string } & Record<string, unknown>) => rt.dispatch(vid, e);

  const job = rt.get(JOB_ID);
  const jstate = job?.snap.state as JobState | undefined;
  const jctx = job?.snap.ctx as JobCtx | undefined;
  const mine = !!job && jctx?.professionalId === meId && !!me;
  const sendJ = (e: { type: string } & Record<string, unknown>) => rt.dispatch(JOB_ID, e);
  const customerLang = rt.languages.customer;
  const penalties = rt.penalties.filter((p) => p.professionalId === meId).length;

  const picker = (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {t("pro.demoWho")}
      <select className={inputClass} value={meId} onChange={(e) => { Object.assign(psession, { meId: e.target.value, idDoc: false, selfie: false, phoneVerified: false }); force(); }}>
        {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value={NEW}>{t("pro.new")}</option>
      </select>
    </label>
  );

  if (!v || !vstate) return <div className="flex flex-col gap-4">{picker}</div>;
  if (vstate !== "approved") {
    return (
      <div className="flex flex-col gap-4">
        {picker}
        <Onboarding state={vstate} ctx={v.snap.ctx as VerificationCtx} send={sendV} rerender={force} />
      </div>
    );
  }

  const status = jstate ? statusFor(jstate) : null;
  return (
    <div className="flex flex-col gap-4">
      {picker}
      <div role="group" className="flex gap-2">
        {TABS.map((tab) => (
          <button key={tab} type="button" aria-pressed={psession.tab === tab} onClick={() => { psession.tab = tab; force(); }}
            className={`min-h-touch flex-1 rounded-full border-2 border-ink px-2 text-sm font-semibold ${psession.tab === tab ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
            {t(`pro.tab.${tab}`)}
          </button>
        ))}
      </div>

      {psession.tab === "schedule" && <ScheduleTab lang={lang} rerender={force} />}
      {psession.tab === "help" && <SupportChatView lang={lang} />}
      {psession.tab === "profile" && <ProfileTab me={me} penalties={penalties} sendVerification={sendV} rerender={force} />}
      {psession.tab === "jobs" && (
        mine && jstate && jctx && me ? (
          <>
            {jstate === "professionalSelected" && <JobRequest draft={session.draft} me={me} customerLang={customerLang} viewerLang={lang} send={sendJ} />}
            {jstate === "quoteSent" && (
              <div className="flex flex-col gap-3">
                {status && <JobStatusBar status={status} />}
                <p>{t("pquote.sent")}</p>
                <p className="font-bold">{t("work.payout", { amount: money(round2(jctx.total * jctx.payoutRatio)) })}</p>
              </div>
            )}
            {jstate === "awaitingDeposit" && (
              <div className="flex flex-col gap-3">
                {status && <JobStatusBar status={status} />}
                <p>{t("pquote.waitingDeposit")}</p>
              </div>
            )}
            {BRANCH.includes(jstate) && <p className="rounded-2xl border-2 border-ink p-3 font-bold">{t(`state.${jstate}`)}</p>}
            {["scheduled", "onTheWay", "checkedIn", "inProgress", "additionalWorkPending", "checklistComplete", "markedComplete", "issueWindow", "issueOpen", "paymentReleased", "rated"].includes(jstate) && (
              <JobWork rt={rt} state={jstate} ctx={jctx} categoryId={session.draft.categoryId} lang={lang} payoutReleased={rt.payouts.length > 0} send={sendJ} rerender={force} />
            )}
            {jstate !== "rated" && <ChatView jobId={JOB_ID} role="professional" />}
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
            <p className="font-semibold">{t("dash.noJobs")}</p>
            <p className="text-sm text-inkSoft">{t("dash.noJobsHint")}</p>
          </div>
        )
      )}
    </div>
  );
}
