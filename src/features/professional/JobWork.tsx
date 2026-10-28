import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { hoursUntil, professionalPendingBalance, round2 } from "@/core/rules";
import { EXTRA_COPPER_LINE, MINISPLIT_TASK, extraCopperPrice } from "@/core/pricing/extraCopper";
import { checklistFor } from "@/core/standards/checklist";
import { cancelLowersQualityScore, statusFor, type JobCtx, type JobState } from "@/core/machines";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { acceptReschedule, declineReschedule, rescheduleStatus } from "@/mocks/runtime/rescheduleActors";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { JOB_ID, session as customerSession } from "@/features/customer/session";
import { localeFor } from "@/i18n";
import { Button } from "@/ui/Button";
import { HlDate } from "@/ui/Highlights";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { useMoney } from "@/features/shared/Money";
import { CaseCard } from "@/features/customer/CaseCard";
import { UnderReview } from "@/features/customer/UnderReview";
import { CloseWindowAction } from "@/features/customer/CloseWindowAction";
import { CompletionChecklist } from "@/features/shared/CompletionChecklist";
import { JobPhotos, usePhotoQueue } from "@/features/shared/JobPhotos";
import { DemoValue } from "@/ui/DemoBadge";
import { psession } from "./session";

type Send = (e: { type: string } & Record<string, unknown>) => void;

/** The professional's steps once a job is booked: on the way, check-in, checklist, before/after photos, completion, payout. */
export function JobWork({ rt, state, ctx, categoryId, lang, payoutReleased, send, rerender }: {
  rt: DemoRuntime; state: JobState; ctx: JobCtx; categoryId: string; lang: Lang; payoutReleased: boolean; send: Send; rerender: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const photos = usePhotoQueue();
  const now = rt.clock.now();
  const status = statusFor(state);
  const items = checklistFor(categoryId);
  const allChecked = items.every((i) => psession.checks[i]);
  const bump = (p: Partial<typeof psession>) => { Object.assign(psession, p); rerender(); };
  const [cancelOpen, setCancelOpen] = useState(false);
  const [addNote, setAddNote] = useState("");
  const [addPayout, setAddPayout] = useState("");
  const [addError, setAddError] = useState(false);
  const [copperMeters, setCopperMeters] = useState("");
  const [copperError, setCopperError] = useState(false);
  const rs = rescheduleStatus(rt, JOB_ID);
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const addBlocked = ctx.additional?.status === "approved" && ctx.additional.blocks && !ctx.additional.paid;
  const copperQty = Number(copperMeters.replace(/,/g, ""));
  const copperPrice = ctx.taskId === MINISPLIT_TASK && ctx.tier ? extraCopperPrice(ctx.taskId, ctx.tier, copperQty) : null;
  const answer = (r: { ok: boolean }) => { if (r.ok) rerender(); };
  const released = rt.payouts.find((p) => p.actorId === JOB_ID)?.amount;
  const pending = professionalPendingBalance(ctx);
  const showChecklist = ["scheduled", "onTheWay", "checkedIn", "inProgress", "additionalWorkPending", "checklistComplete", "markedComplete", "issueWindow", "issueOpen"].includes(state);
  const beforeOk = photos.count("before") >= config.completionCheck.minBeforePhotos;
  const afterOk = photos.count("after") >= config.completionCheck.minAfterPhotos;

  return (
    <div className="flex flex-col gap-4">
      {status && <JobStatusBar status={status} />}
      <p><HlDate>{t("work.scheduled", { when: formatDateTime(ctx.jobStart, localeFor[lang]) })}</HlDate></p>
      {showChecklist && (
        <>
          <p className="text-xl font-bold">{t("work.pendingBalance", { amount: money(pending) })}</p>
          {ctx.issueWindowEndsAt && state === "issueWindow" && (
            <p aria-live="polite">
              <DemoValue>
                <HlDate>{t("work.countdown", { when: when(ctx.issueWindowEndsAt), hours: hoursUntil(ctx.issueWindowEndsAt, now) })}</HlDate>
              </DemoValue>
            </p>
          )}
          <CompletionChecklist
            categoryId={categoryId}
            checks={psession.completionChecks}
            onToggle={(id, checked) => bump({ completionChecks: { ...psession.completionChecks, [id]: checked } })}
            optionalNote={t("work.sameChecklist")}
          />
        </>
      )}

      {state === "scheduled" && rs.status === "pending" && rs.proposedStart && rs.expiresAt && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
          <h3 className="text-lg font-bold">{t("resched.pro.title")}</h3>
          <p>{t("resched.pro.body", { when: when(rs.proposedStart), deadline: when(rs.expiresAt) })}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => answer(declineReschedule(rt, JOB_ID))}>{t("btn.declineTime")}</Button>
            <Button className="flex-1" onClick={() => answer(acceptReschedule(rt, JOB_ID))}>{t("btn.acceptTime")}</Button>
          </div>
        </section>
      )}

      {state === "scheduled" && (
        <>
          <p className="text-inkSoft">{t("work.onWayNote")}</p>
          <Button onClick={() => send({ type: "ON_THE_WAY" })}>{t("btn.onMyWay")}</Button>
        </>
      )}
      {state === "onTheWay" && <Button onClick={() => send({ type: "CHECK_IN" })}>{t("btn.checkIn")}</Button>}
      {state === "checkedIn" && (
        <>
          <JobPhotos phase="before" label={t("work.photosBefore")} addLabel={t("btn.addBefore")} min={config.completionCheck.minBeforePhotos} now={now} lang={lang} />
          {!beforeOk && <p className="text-sm text-inkSoft">{t("work.photosNeed", { count: config.completionCheck.minBeforePhotos })}</p>}
          <Button disabled={!beforeOk} onClick={() => send({ type: "START_WORK" })}>{t("btn.startWork")}</Button>
        </>
      )}
      {state === "inProgress" && (
        <>
          <fieldset className="flex flex-col gap-1">
            <legend className="font-semibold">{t("work.checklist")}</legend>
            {items.map((i) => (
              <label key={i} className="flex min-h-touch items-center gap-3">
                <input type="checkbox" className="h-6 w-6" checked={!!psession.checks[i]} onChange={(e) => bump({ checks: { ...psession.checks, [i]: e.target.checked } })} />
                {t(`checklist.${i}`)}
              </label>
            ))}
            <p className="text-sm text-inkSoft">{t("work.fixxStandard")}</p>
          </fieldset>
          <JobPhotos phase="before" label={t("work.photosBefore")} addLabel={t("btn.addBefore")} min={config.completionCheck.minBeforePhotos} now={now} lang={lang} />
          <JobPhotos phase="after" label={t("work.photosAfter")} addLabel={t("btn.addAfter")} min={config.completionCheck.minAfterPhotos} now={now} lang={lang} />
          {!allChecked && <p className="text-sm text-inkSoft">{t("work.checklistFirst")}</p>}
          <Button disabled={!allChecked} onClick={() => send({ type: "CHECKLIST_COMPLETE" })}>{t("btn.finishChecklist")}</Button>
          {ctx.taskId === MINISPLIT_TASK && (
            <section aria-label={t("addl.copper.title")} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
              <h3 className="font-bold">{t("addl.copper.title")}</h3>
              <Field label={t("addl.copper.meters")}>
                <input className={inputClass} inputMode="decimal" value={copperMeters} onChange={(e) => setCopperMeters(e.target.value)} />
              </Field>
              {copperPrice != null && <p className="font-semibold">{t("addl.copper.preview", { amount: money(copperPrice) })}</p>}
              {copperError && <ErrorText>{t("addl.copper.invalid")}</ErrorText>}
              <Button variant="secondary" onClick={() => {
                if (copperPrice == null) return setCopperError(true);
                setCopperError(false);
                customerSession.additionalNote = "";
                customerSession.additionalLang = lang;
                send({ type: "REQUEST_ADDITIONAL_WORK", amount: copperPrice, lineId: EXTRA_COPPER_LINE, meters: copperQty });
              }}>{t("btn.requestAddl")}</Button>
            </section>
          )}
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
            <h3 className="font-bold">{t("addl.pro.request")}</h3>
            <Field label={t("addl.note")}><input className={inputClass} value={addNote} onChange={(e) => setAddNote(e.target.value)} /></Field>
            <Field label={t("addl.payout")}><input className={inputClass} inputMode="decimal" value={addPayout} onChange={(e) => setAddPayout(e.target.value)} /></Field>
            {addError && <ErrorText>{t("addl.invalid")}</ErrorText>}
            <Button variant="secondary" onClick={() => {
              const p = Number(addPayout.replace(/,/g, ""));
              if (!addNote.trim() || !(p > 0)) return setAddError(true);
              setAddError(false);
              customerSession.additionalNote = addNote.trim();
              customerSession.additionalLang = lang;
              send({ type: "REQUEST_ADDITIONAL_WORK", amount: Math.round(p / ctx.payoutRatio / 10) * 10 });
            }}>{t("btn.requestAddl")}</Button>
          </section>
        </>
      )}
      {state === "checklistComplete" && (
        <>
          <JobPhotos phase="after" label={t("work.photosAfter")} addLabel={t("btn.addAfter")} min={config.completionCheck.minAfterPhotos} now={now} lang={lang} />
          <p className="text-sm text-inkSoft">{t("work.completeNote")}</p>
          {!afterOk && <p className="text-sm text-inkSoft">{t("work.photosNeed", { count: config.completionCheck.minAfterPhotos })}</p>}
          {addBlocked && <p role="alert" className="rounded-lg border-2 border-ink p-2 text-sm font-bold">{t("addl.pro.unpaid")}</p>}
          <Button disabled={addBlocked || !afterOk} onClick={() => send({ type: "MARK_COMPLETE" })}>{t("btn.markComplete")}</Button>
        </>
      )}
      {state === "additionalWorkPending" && <p>{t("addl.pro.waiting")}</p>}
      {(state === "scheduled" || state === "onTheWay") && (
        cancelOpen ? (
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
            <h3 className="text-lg font-bold">{t("cancel.pro.title")}</h3>
            <p className="font-semibold">{cancelLowersQualityScore(state) ? t("cancel.pro.late") : t("cancel.pro.early")}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t("btn.keepJob")}</Button>
              <Button className="flex-1" onClick={() => send({ type: "PRO_CANCELS" })}>{t("btn.cancelAsPro")}</Button>
            </div>
          </section>
        ) : <Button variant="secondary" onClick={() => setCancelOpen(true)}>{t("btn.cancelAsPro")}</Button>
      )}
      {(state === "markedComplete" || state === "issueWindow") && (
        <>
          <p>{t("work.waitWindow")}</p>
          {state === "issueWindow" && <CloseWindowAction rt={rt} jobId={JOB_ID} />}
        </>
      )}
      {state === "issueOpen" && (
        <>
          <UnderReview ctx={ctx} lang={lang} role="professional" />
          {ctx.returnVisitBy && !ctx.returnScheduled && now.getTime() <= ctx.returnVisitBy.getTime() && (
            <section className="flex flex-col gap-2 rounded-2xl border border-line p-3">
              <h3 className="font-bold">{t("work.returnTitle")}</h3>
              <p><DemoValue><HlDate>{t("work.returnBody", { when: when(ctx.returnVisitBy) })}</HlDate></DemoValue></p>
              <Button onClick={() => send({ type: "SCHEDULE_RETURN" })}>{t("btn.scheduleReturn")}</Button>
            </section>
          )}
          {ctx.returnScheduled && <p className="font-semibold">{t("work.returnSet")}</p>}
        </>
      )}
      {(state === "paymentReleased" || state === "rated") && payoutReleased && <p className="text-xl font-bold">{t("work.payoutReleased", { amount: money(released ?? round2(ctx.total * ctx.payoutRatio)) })}</p>}
      {(state === "issueOpen" || state === "paymentReleased" || state === "rated") && <CaseCard rt={rt} jobId={JOB_ID} role="professional" lang={lang} />}
    </div>
  );
}
