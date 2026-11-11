import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { clock } from "@/core/clock/clock";
import { isAgentHours } from "@/core/rules";
import { zoneNames, zones } from "./data";
import { TradePicker } from "./tradePicker";
import { TradeIcon, TradeName } from "./tradeIcons";
import { descriptionForJobs, jobsForCategory } from "./catalogJobs";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { requestSubProgress } from "./requestProgress";
import { HomeQuoteFacts } from "./HomeQuoteFacts";
import { HomeSummaryCard } from "./HomeSummaryCard";
import { JobChips, type JobOption } from "./JobChips";
import { JobTray } from "./JobTray";
import "./jobChips.css";
import type { Draft } from "./session";

const UNDO_MS = 5000;

export function RequestBuilder({ draft, onChange, onReview, onEditHome, autoFocusDescription = false }: {
  draft: Draft;
  onChange: (p: Partial<Draft>) => void;
  onReview: () => void;
  onEditHome?: () => void;
  /** Describe-it opens the form with the description ready to type. */
  autoFocusDescription?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [undo, setUndo] = useState<string | null>(null);
  const jobs = jobsForCategory(draft.categoryId, lang);
  const options: JobOption[] = jobs.map((job) => ({
    id: job.id,
    label: job.title,
    keepCase: job.keepCase,
    status: job.pendingReview ? t("state.pendingReview") : undefined
  }));

  useEffect(() => {
    if (!autoFocusDescription) return;
    descriptionRef.current?.focus();
  }, [autoFocusDescription]);

  useEffect(() => {
    if (undo == null) return;
    const id = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(id);
  }, [undo]);

  const seenLang = useRef(lang);
  useEffect(() => {
    if (seenLang.current === lang) return;
    seenLang.current = lang;
    if (draft.descriptionEdited) return;
    const next = descriptionForJobs(draft.categoryId, lang, draft.selectedJobIds);
    if (next !== draft.description) onChange({ description: next });
  }, [lang, draft.categoryId, draft.description, draft.descriptionEdited, draft.selectedJobIds, onChange]);

  const onJobs = (selectedJobIds: string[]) => {
    if (draft.descriptionEdited) onChange({ selectedJobIds });
    else onChange({ selectedJobIds, description: descriptionForJobs(draft.categoryId, lang, selectedJobIds) });
  };

  const onDescription = (value: string) => {
    if (value.trim() === "") onChange({ description: "", descriptionEdited: false });
    else onChange({ description: value, descriptionEdited: true });
  };

  const regenerate = () => {
    setUndo(draft.description);
    onChange({ description: descriptionForJobs(draft.categoryId, lang, draft.selectedJobIds), descriptionEdited: false });
  };

  const focusDescription = () => {
    const el = document.getElementById("request-description");
    if (!(el instanceof HTMLElement)) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.focus();
  };

  const chosenLabels = draft.selectedJobIds.flatMap((id) => {
    const job = jobs.find((item) => item.id === id);
    return job ? [job.title] : [];
  });

  const review = () => {
    const e: string[] = [];
    if (!draft.categoryId.trim()) e.push("request.errorCategory");
    if (!draft.homeownerName.trim()) e.push("request.errorName");
    if (!draft.community.trim()) e.push("request.errorCommunity");
    if (!draft.description.trim()) e.push("request.errorDescription");
    if (draft.photos < 1 && !draft.emergency) e.push("request.errorPhoto");
    if (!draft.street.trim()) e.push("request.errorStreet");
    setErrors(e);
    if (e.length === 0) onReview();
  };

  return (
    <div className={`flex flex-col gap-4 ${chosenLabels.length > 0 ? "request-tray-pad" : ""}`}>
      <JobStatusBar status="requestSubmitted" progress={requestSubProgress(draft)} />
      <h2 className="text-2xl font-bold">{t("request.title")}</h2>
      <HomeSummaryCard draft={draft} onEditHome={onEditHome} />
      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold">{t("request.category")}</legend>
        <TradePicker
          lang={lang}
          selectedId={draft.categoryId}
          onPick={(id) => {
            if (id === draft.categoryId) return;
            setUndo(null);
            if (draft.descriptionEdited) onChange({ categoryId: id, selectedJobIds: [] });
            else onChange({ categoryId: id, selectedJobIds: [], description: "" });
          }}
        />
      </fieldset>
      {draft.categoryId && <section key={draft.categoryId} aria-labelledby="request-jobs-heading" className="job-spotlight glass flex flex-col gap-2 rounded-[20px] p-4">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-inkSoft">{t("request.selectedTrade")}</span>
          <TradeName categoryId={draft.categoryId} lang={lang} />
        </p>
        <h3 id="request-jobs-heading" className="flex items-center gap-2 font-semibold">
          <TradeIcon categoryId={draft.categoryId} />
          <span>{t("request.jobs")}</span>
        </h3>
        <p className="text-sm text-inkSoft">{t("request.jobsHint")}</p>
        <JobChips headingId="request-jobs-heading" jobs={options} selectedIds={draft.selectedJobIds} onChange={onJobs} />
      </section>}
      <Field label={t("request.description")} hint={t("request.descriptionHint")}>
        <textarea
          id="request-description"
          ref={descriptionRef}
          className={`${inputClass} min-h-[7rem] scroll-mb-32 py-2`}
          required
          placeholder={t("request.descriptionHint")}
          value={draft.description}
          onChange={(e) => onDescription(e.target.value)}
        />
      </Field>
      {(draft.descriptionEdited || undo != null) && (
        <div className="flex flex-wrap gap-2">
          {draft.descriptionEdited && (
            <button type="button" className="min-h-touch self-start px-1 text-left text-sm font-semibold text-ink underline" onClick={regenerate}>
              {t("request.regenerate")}
            </button>
          )}
          {undo != null && (
            <button type="button" className="min-h-touch self-start px-1 text-left text-sm font-semibold text-ink underline" onClick={() => { onChange({ description: undo, descriptionEdited: true }); setUndo(null); }}>
              {t("request.undo")}
            </button>
          )}
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">{t("request.photos")}</legend>
        <p className="text-sm text-inkSoft" aria-live="polite">{draft.photos === 0 ? t("request.noPhotos") : t("request.photoCount", { count: draft.photos })}</p>
        <ul className="text-sm">{Array.from({ length: draft.photos }, (_, i) => <li key={i}>{t("request.photoDemo", { n: i + 1 })}</li>)}</ul>
        <Button variant="secondary" onClick={() => onChange({ photos: draft.photos + 1 })}>{t("btn.addPhoto")}</Button>
        {draft.emergency && <p className="text-sm text-inkSoft">{t("request.photoOptional")}</p>}
      </fieldset>

      <Field label={t("request.measurements")} hint={t("request.measurementsHint")}>
        <input className={inputClass} value={draft.measurements} onChange={(e) => onChange({ measurements: e.target.value })} />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold">{t("request.address")}</legend>
        <Field label={t("request.zone")}>
          <select className={inputClass} value={draft.zoneId} onChange={(e) => onChange({ zoneId: e.target.value })}>
            {zones.map((z) => <option key={z.id} value={z.id}>{zoneNames[z.id]}</option>)}
            <option value="outside">{t("request.outside")}</option>
          </select>
        </Field>
        {draft.zoneId === "outside" && <p className="text-sm text-inkSoft">{t("request.outsideNote", { hours: config.outOfAreaFollowUpHours })}</p>}
        <Field label={t("request.street")}>
          <input className={inputClass} autoComplete="street-address" value={draft.street} onChange={(e) => onChange({ street: e.target.value })} />
        </Field>
      </fieldset>

      <div className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-3">
        <label className="flex min-h-touch items-center gap-3 font-semibold">
          <input type="checkbox" className="h-6 w-6" checked={draft.emergency} onChange={(e) => onChange({ emergency: e.target.checked })} />
          {t("request.emergency")}
        </label>
        {draft.emergency && (
          <>
            <p className="text-sm"><DemoValue>{t("request.emergencyNote")}</DemoValue></p>
            <p className="text-sm font-semibold">{t("home.emergencyLine")}</p>
            {!isAgentHours(clock.now()) && <p className="text-sm">{t("request.emergencyAfterHours")}</p>}
          </>
        )}
      </div>

      {errors.length > 0 && <ErrorText>{errors.map((k) => <span key={k} className="block">{t(k)}</span>)}</ErrorText>}
      <Button onClick={review}>{t("btn.reviewRequest")}</Button>
      <JobTray labels={chosenLabels} onContinue={focusDescription} />
    </div>
  );
}

export function RequestReview({ draft, onEdit, onSubmit }: { draft: Draft; onEdit: () => void; onSubmit: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const where = draft.zoneId === "outside" ? t("request.outside") : zoneNames[draft.zoneId];
  return (
    <div className="flex flex-col gap-4">
      <JobStatusBar status="requestSubmitted" progress={requestSubProgress(draft, true)} />
      <h2 className="text-2xl font-bold">{t("review.title")}</h2>
      <dl className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
        <div><dt className="text-sm text-inkSoft">{t("request.homeownerName")}</dt><dd className="font-bold">{draft.homeownerName}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.community")}</dt><dd>{draft.community}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.category")}</dt><dd className="font-bold"><TradeName categoryId={draft.categoryId} lang={lang} /></dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.description")}</dt><dd>{draft.description}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.photos")}</dt><dd>{draft.photos === 0 ? t("request.noPhotos") : t("request.photoCount", { count: draft.photos })}</dd></div>
        {draft.measurements && <div><dt className="text-sm text-inkSoft">{t("request.measurements")}</dt><dd>{draft.measurements}</dd></div>}
        <div><dt className="text-sm text-inkSoft">{t("request.address")}</dt><dd>{where}, {draft.street}</dd></div>
        {draft.emergency && <div><dd className="font-bold">{t("request.emergency")}</dd></div>}
      </dl>
      <HomeQuoteFacts draft={draft} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onEdit}>{t("btn.edit")}</Button>
        <Button className="flex-1" onClick={onSubmit}>{t("btn.submitRequest")}</Button>
      </div>
    </div>
  );
}
