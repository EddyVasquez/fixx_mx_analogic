import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { manualReviewFollowUp, round2 } from "@/core/rules";
import { CHECKLIST_ITEMS } from "@/core/standards/checklist";
import { statusFor, type CaseCtx, type CaseState, type JobCtx, type JobState, type VerificationState, type WarrantyCtx, type WarrantyState } from "@/core/machines";
import { languageNames, localeFor } from "@/i18n";
import type { DemoRuntime, NoteRecord } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { useMoney } from "@/features/shared/Money";
import { categories, customers, homes, professionals, zoneNames } from "@/features/customer/data";
import { JOB_ID, ratings, session } from "@/features/customer/session";
import { Table } from "./Table";

type P = { rt: DemoRuntime; lang: Lang };
type T = (k: string, o?: Record<string, unknown>) => string;

export const stateLabel = (t: T, state: string): string => {
  const s = statusFor(state as JobState);
  return s ? t(`status.${s}`) : t(`state.${state}`);
};
const useWhen = (lang: Lang) => (d: Date | string) => formatDateTime(new Date(d), localeFor[lang]);
const proName = (id: string | null | undefined) => professionals.find((p) => p.id === id)?.name ?? "";
const catName = (id: string, lang: Lang) => categories.find((c) => c.id === id)?.names[lang] ?? id;

export function RequestsSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const when = useWhen(lang);
  const job = rt.get(JOB_ID);
  const d = session.draft;
  const state = job?.snap.state as JobState | undefined;
  return (
    <div className="flex flex-col gap-3">
      <Table caption={t("admin.s.requests")} head={[t("admin.col.category"), t("admin.col.area"), t("admin.col.urgent"), t("admin.col.state")]}
        rows={job && state ? [[catName(d.categoryId, lang), d.zoneId === "outside" ? t("request.outside") : zoneNames[d.zoneId], d.emergency ? t("admin.yes") : t("admin.no"), stateLabel(t, state)]] : []} />
      {job && state === "manualReview" && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-3">
          <p className="font-semibold">{t("admin.followUp", { when: when(manualReviewFollowUp(new Date(job.snap.history[0]?.at ?? rt.clock.now().toISOString()))) })}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => rt.dispatch(JOB_ID, { type: "MANUAL_REVIEW_DECLINED" })}>{t("admin.reject")}</Button>
            <Button className="flex-1" onClick={() => rt.dispatch(JOB_ID, { type: "MANUAL_REVIEW_APPROVED" })}>{t("admin.approve")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HomeownersSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const cancels = rt.log.filter((l) => l.event === "CUSTOMER_CANCELS" && l.ok).length;
  const rows = customers.map((c) => {
    const h = homes.find((x) => x.userId === c.id);
    return [c.name, languageNames[c.language as Lang], c.phone, c.email, h ? `${h.fraccionamiento}, ${zoneNames[h.zoneId] ?? ""}` : "", c.language === rt.languages.customer ? String(cancels) : "0"];
  });
  return <Table caption={t("admin.s.homeowners")} head={[t("admin.col.name"), t("admin.col.language"), t("admin.col.phone"), t("admin.col.email"), t("admin.col.home"), t("admin.col.cancellations")]} rows={rows} />;
}

export function ProfessionalsSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const rows = professionals.map((p) => {
    const v = rt.get(`verify:${p.id}`)?.snap.state ?? (p.verification === "approved" ? "approved" : "pending");
    const delta = rt.scoreChanges.filter((c) => c.professionalId === p.id).reduce((s, c) => s + c.delta, 0);
    const mine = ratings.filter((r) => r.proId === p.id);
    const avg = mine.length ? (mine.reduce((s, r) => s + (r.values["overall"] ?? 0), 0) / mine.length).toFixed(1) : "—";
    return [p.name, zoneNames[p.zoneId], p.trades.map((x) => catName(x, lang)).join(", "), p.level ? t(`level.${p.level}`) : "—",
      p.qualityScore == null ? "—" : String(p.qualityScore + delta), t(`admin.vstate.${v}`), String(rt.penalties.filter((x) => x.professionalId === p.id).length), avg];
  });
  return <Table caption={t("admin.s.professionals")} head={[t("admin.col.name"), t("admin.col.area"), t("admin.col.trades"), t("admin.col.level"), t("admin.col.score"), t("admin.col.verification"), t("admin.col.penalties"), t("admin.col.rating")]} rows={rows} />;
}

function VerifyActions({ rt, id }: { rt: DemoRuntime; id: string }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("blurry");
  return (
    <div className="flex flex-col gap-2">
      <select aria-label={t("admin.reason")} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
        {["blurry", "mismatch"].map((r) => <option key={r} value={r}>{t(`rejectReason.${r}`)}</option>)}
      </select>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => rt.dispatch(id, { type: "REJECT", reason })}>{t("admin.reject")}</Button>
        <Button onClick={() => rt.dispatch(id, { type: "APPROVE" })}>{t("admin.approve")}</Button>
      </div>
    </div>
  );
}
export function VerificationSection({ rt }: P) {
  const { t } = useTranslation();
  const rows = rt.list("verification").map((a) => {
    const pid = a.id.replace("verify:", "");
    const st = a.snap.state as VerificationState;
    return [pid === "new" ? t("pro.new") : proName(pid), t(`admin.vstate.${st}`), st === "pending" ? <VerifyActions key={a.id} rt={rt} id={a.id} /> : (a.snap.ctx as { reason: string | null }).reason ? t(`rejectReason.${(a.snap.ctx as { reason: string }).reason}`) : "—"];
  });
  return rows.length === 0 ? <p className="rounded-2xl border border-line bg-paper p-4">{t("admin.verify.none")}</p>
    : <Table caption={t("admin.s.verification")} head={[t("admin.col.name"), t("admin.col.status"), t("admin.col.actions")]} rows={rows} />;
}

export function JobsSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const money = useMoney();
  const when = useWhen(lang);
  const job = rt.get(JOB_ID);
  if (!job) return <Table caption={t("admin.s.jobs")} head={[]} rows={[]} />;
  const c = job.snap.ctx as JobCtx;
  const st = job.snap.state as JobState;
  return <Table caption={t("admin.s.jobs")}
    head={[t("admin.col.category"), t("admin.col.professional"), t("admin.col.state"), t("admin.col.method"), t("admin.col.total"), t("admin.col.payout"), t("admin.col.date")]}
    rows={[[catName(session.draft.categoryId, lang), proName(c.professionalId), stateLabel(t, st), c.method ? t(`method.${c.method}`) : "—", c.total ? money(c.total) : "—", c.total ? money(round2(c.total * c.payoutRatio)) : "—", c.total ? when(c.jobStart) : "—"]]} />;
}

export function QuotesSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const money = useMoney();
  const job = rt.get(JOB_ID);
  const c = job?.snap.ctx as JobCtx | undefined;
  if (!c || !c.total) return <Table caption={t("admin.s.quotes")} head={[]} rows={[]} />;
  return (
    <div className="flex flex-col gap-3">
      <Table caption={t("admin.s.quotes")} head={[t("admin.col.line"), t("admin.col.amount")]} rows={[...c.lines.map((l) => [t(`quote.line.${l.id}`), money(l.amount)]), [<b key="t">{t("quote.label.total")}</b>, <b key="a">{money(c.total)}</b>]]} />
      <Table caption={t("admin.col.payout")} head={[t("admin.col.payout"), t("admin.col.travelFee"), t("admin.col.adjustment"), t("admin.col.official")]}
        rows={[[money(round2(c.total * c.payoutRatio)), <DemoValue key="f">{money(c.travelFee)}</DemoValue>, c.adjustmentReason ?? "—", languageNames[rt.languages.customer]]]} />
    </div>
  );
}

export function StandardsSection({ lang }: P) {
  const { t } = useTranslation();
  const money = useMoney();
  const rows = categories.map((c) => {
    const r = config.estimateRangesMXN[c.id];
    return [c.names[lang], c.lineType, <DemoValue key="w">{t("quote.warrantyDays", { days: config.warrantyDaysByCategory[c.id] ?? 0 })}</DemoValue>,
      r ? <DemoValue key="r">{`${money(r[0])} – ${money(r[1])}`}</DemoValue> : "—", String(CHECKLIST_ITEMS.length)];
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-inkSoft">{t("admin.standards.note")}</p>
      <Table caption={t("admin.s.standards")} head={[t("admin.col.category"), t("admin.col.lineType"), t("admin.col.warranty"), t("admin.col.estimate"), t("admin.col.checklist")]} rows={rows} />
    </div>
  );
}

export function CasesSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const money = useMoney();
  const when = useWhen(lang);
  const [held, setHeld] = useState("");
  const [error, setError] = useState(false);
  const a = rt.get(`case:${JOB_ID}`);
  if (!a) return <Table caption={t("admin.s.cases")} head={[]} rows={[]} />;
  const c = a.snap.ctx as CaseCtx;
  const st = a.snap.state as CaseState;
  const go = (e: { type: string } & Record<string, unknown>) => rt.dispatch(a.id, e);
  return (
    <div className="flex flex-col gap-3">
      <Table caption={t("admin.s.cases")} head={[t("admin.col.status"), t("admin.col.held"), t("admin.col.heldShare"), t("admin.col.decision"), t("admin.col.deadline"), t("admin.col.reviews")]}
        rows={[[t(`case.status.${st}`), money(c.heldAmount), money(c.heldPayout), c.decision ? t(`admin.decide.${c.decision}`) : "—", st === "decided" && c.reviewBy ? when(c.reviewBy) : when(c.resolveBy), String(c.reviewsUsed.length)]]} />
      {(st === "reported" || st === "underReview") && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
          <Field label={t("admin.setHeld")}><input className={inputClass} inputMode="decimal" value={held} onChange={(e) => setHeld(e.target.value)} /></Field>
          {error && <ErrorText>{t("admin.heldInvalid")}</ErrorText>}
          <Button variant="secondary" onClick={() => setError(!rt.setCaseHeld(JOB_ID, Number(held.replace(/,/g, ""))))}>{t("admin.saveHeld")}</Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {st === "reported" && <Button variant="secondary" onClick={() => go({ type: "START_REVIEW" })}>{t("admin.startReview")}</Button>}
        {st === "underReview" && (["refundCustomer", "releaseProfessional", "split"] as const).map((d) => (
          <Button key={d} variant="secondary" onClick={() => go({ type: "DECIDE", decision: d })}>{t(`admin.decide.${d}`)}</Button>
        ))}
        {st === "inReview" && <Button variant="secondary" onClick={() => go({ type: "REVIEW_DECIDED", decision: c.decision ?? "split" })}>{t("admin.finishReview")}</Button>}
      </div>
    </div>
  );
}

export function WarrantiesSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const when = useWhen(lang);
  const a = rt.get(`warranty:${JOB_ID}`);
  if (!a) return <Table caption={t("admin.s.warranties")} head={[]} rows={[]} />;
  const c = a.snap.ctx as WarrantyCtx;
  const st = a.snap.state as WarrantyState;
  const go = (e: { type: string } & Record<string, unknown>) => rt.dispatch(a.id, e);
  return (
    <div className="flex flex-col gap-3">
      <Table caption={t("admin.s.warranties")} head={[t("admin.col.category"), t("admin.col.warranty"), t("admin.col.ends"), t("admin.col.claim")]}
        rows={[[catName(session.draft.categoryId, lang), <DemoValue key="d">{t("quote.warrantyDays", { days: config.warrantyDaysByCategory[session.draft.categoryId] ?? 0 })}</DemoValue>, when(c.endsAt),
          st === "claimFiled" || st === "inReview" ? t(`claim.status.${st}`) : st === "expired" ? t("warranty.endedOn", { date: when(c.endsAt) }) : c.lastOutcome ? t(`claim.outcome.${c.lastOutcome}`) : "—"]]} />
      {st === "claimFiled" && <Button variant="secondary" onClick={() => go({ type: "START_REVIEW" })}>{t("admin.claim.start")}</Button>}
      {st === "inReview" && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => go({ type: "RESOLVE", outcome: "rejected" })}>{t("admin.claim.reject")}</Button>
          <Button className="flex-1" onClick={() => go({ type: "RESOLVE", outcome: "resolved" })}>{t("admin.claim.approve")}</Button>
        </div>
      )}
    </div>
  );
}

export function RefundsSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const money = useMoney();
  const when = useWhen(lang);
  const rows = rt.refunds.map((r) => [money(r.amount), t(`admin.dest.${r.destination}`),
    r.destination === "original" ? "—" : r.clabe ? `••••${r.clabe.slice(-4)} (${t("admin.refund.provided")})` : t("admin.refund.waiting"), when(r.expectedBy)]);
  return <Table caption={t("admin.s.refunds")} head={[t("admin.col.amount"), t("admin.col.destination"), t("admin.col.account"), t("admin.col.expected")]} rows={rows} />;
}

export function QualitySection({ rt, lang }: P) {
  const { t } = useTranslation();
  const when = useWhen(lang);
  const [pro, setPro] = useState(professionals[0]?.id ?? "");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-inkSoft">{t("admin.score.auto")}</p>
      <Table caption={t("admin.s.quality")} head={[t("admin.col.professional"), t("admin.col.delta"), t("admin.col.reason"), t("admin.col.date")]}
        rows={[...rt.penalties.map((p) => [proName(p.professionalId), "—", p.reason, when(p.at)]), ...rt.scoreChanges.map((c) => [proName(c.professionalId), String(c.delta), c.reason, when(c.at)])]} />
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
        <Field label={t("admin.score.pro")}>
          <select className={inputClass} value={pro} onChange={(e) => setPro(e.target.value)}>{professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </Field>
        <Field label={t("admin.score.delta")}><input className={inputClass} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} /></Field>
        <Field label={t("admin.score.reason")}><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <ErrorText>{t("admin.score.invalid")}</ErrorText>}
        <Button variant="secondary" onClick={() => { const ok = rt.recordScoreChange(pro, Number(delta), reason); setError(!ok); if (ok) { setDelta(""); setReason(""); } }}>{t("admin.score.add")}</Button>
      </div>
    </div>
  );
}

export function NotesSection({ rt, lang }: P) {
  const { t } = useTranslation();
  const when = useWhen(lang);
  const [entity, setEntity] = useState<NoteRecord["entity"]>("job");
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-inkSoft">{t("admin.noteInternal")}</p>
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
        <Field label={t("admin.noteAbout")}>
          <select className={inputClass} value={entity} onChange={(e) => setEntity(e.target.value as NoteRecord["entity"])}>
            {(["job", "professional", "homeowner"] as const).map((x) => <option key={x} value={x}>{t(`admin.entity.${x}`)}</option>)}
          </select>
        </Field>
        <Field label={t("admin.noteText")}><textarea className={`${inputClass} min-h-[5rem] py-2`} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <Button variant="secondary" onClick={() => { if (rt.addNote(entity, text)) setText(""); }}>{t("admin.addNote")}</Button>
      </div>
      <Table caption={t("admin.s.notes")} head={[t("admin.col.about"), t("admin.col.note"), t("admin.col.date")]}
        rows={rt.notes.slice().reverse().map((n) => [t(`admin.entity.${n.entity}`), n.text, when(n.at)])} />
    </div>
  );
}
