import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { round2 } from "@/core/rules";
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
import { CloseWindowAction } from "@/features/customer/CloseWindowAction";
import { psession } from "./session";

type Send = (e: { type: string } & Record<string, unknown>) => void;

function Photos({ label, count, addLabel, onAdd }: { label: string; count: number; addLabel: string; onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-semibold">{label}</legend>
      <ul className="text-sm">{Array.from({ length: count }, (_, i) => <li key={i}>{t("request.photoDemo", { n: i + 1 })}</li>)}</ul>
      <Button variant="secondary" onClick={onAdd}>{addLabel}</Button>
    </fieldset>
  );
}

/** The professional's steps once a job is booked: on the way, check-in, checklist, before/after photos, completion, payout. */
export function JobWork({ rt, state, ctx, categoryId, lang, payoutReleased, send, rerender }: {
  rt: DemoRuntime; state: JobState; ctx: JobCtx; categoryId: string; lang: Lang; payoutReleased: boolean; send: Send; rerender: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const status = statusFor(state);
  const items = checklistFor(categoryId);
  const allChecked = items.every((i) => psession.checks[i]);
  const payout = money(round2(ctx.total * ctx.payoutRatio));
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

  return (
    <div className="flex flex-col gap-4">
      {status && <JobStatusBar status={status} />}
      <p><HlDate>{t("work.scheduled", { when: formatDateTime(ctx.jobStart, localeFor[lang]) })}</HlDate></p>

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
          <Photos label={t("work.photosBefore")} count={psession.before} addLabel={t("btn.addBefore")} onAdd={() => bump({ before: psession.before + 1 })} />
          <Button onClick={() => send({ type: "START_WORK" })}>{t("btn.startWork")}</Button>
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
          <Photos label={t("work.photosBefore")} count={psession.before} addLabel={t("btn.addBefore")} onAdd={() => bump({ before: psession.before + 1 })} />
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
          <Photos label={t("work.photosAfter")} count={psession.after} addLabel={t("btn.addAfter")} onAdd={() => bump({ after: psession.after + 1 })} />
          <p className="text-sm text-inkSoft">{t("work.completeNote")}</p>
          {addBlocked && <p role="alert" className="rounded-lg border-2 border-ink p-2 text-sm font-bold">{t("addl.pro.unpaid")}</p>}
          <Button disabled={addBlocked} onClick={() => send({ type: "MARK_COMPLETE" })}>{t("btn.markComplete")}</Button>
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
          <p className="font-bold">{t("work.payout", { amount: payout })}</p>
          {state === "issueWindow" && <CloseWindowAction rt={rt} jobId={JOB_ID} />}
        </>
      )}
      {(state === "paymentReleased" || state === "rated") && payoutReleased && <p className="text-xl font-bold">{t("work.payoutReleased", { amount: money(released ?? round2(ctx.total * ctx.payoutRatio)) })}</p>}
      {(state === "issueOpen" || state === "paymentReleased" || state === "rated") && <CaseCard rt={rt} jobId={JOB_ID} role="professional" lang={lang} />}
    </div>
  );
}
