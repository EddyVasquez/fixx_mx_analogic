import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { clock } from "@/core/clock/clock";
import { isAgentHours } from "@/core/rules";
import { categories, zoneNames, zones } from "./data";
import { jobsForCategory, type CatalogJob } from "./catalogJobs";
import { HomeQuoteFacts } from "./HomeQuoteFacts";
import { cleaningAreaTiers } from "./homeModel";
import { JobChips, type JobOption } from "./JobChips";
import { buildJobSentence } from "./jobSentence";
import type { Draft } from "./session";

const UNDO_MS = 5000;

function countFrom(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sentenceFor(categoryId: string, lang: Lang, ids: readonly string[]): string {
  const byId = new Map(jobsForCategory(categoryId, lang).map((job) => [job.id, job]));
  const ordered: CatalogJob[] = [];
  for (const id of ids) {
    const job = byId.get(id);
    if (job) ordered.push(job);
  }
  return buildJobSentence(ordered.map((job) => ({ label: job.title, keepCase: job.keepCase })), lang);
}

export function RequestBuilder({ draft, onChange, onReview }: { draft: Draft; onChange: (p: Partial<Draft>) => void; onReview: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
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
    if (undo == null) return;
    const id = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(id);
  }, [undo]);

  const seenLang = useRef(lang);
  useEffect(() => {
    if (seenLang.current === lang) return;
    seenLang.current = lang;
    if (draft.descriptionEdited) return;
    const next = sentenceFor(draft.categoryId, lang, draft.selectedJobIds);
    if (next !== draft.description) onChange({ description: next });
  }, [lang, draft.categoryId, draft.description, draft.descriptionEdited, draft.selectedJobIds, onChange]);

  const onJobs = (selectedJobIds: string[]) => {
    if (draft.descriptionEdited) onChange({ selectedJobIds });
    else onChange({ selectedJobIds, description: sentenceFor(draft.categoryId, lang, selectedJobIds) });
  };

  const onDescription = (value: string) => {
    if (value.trim() === "") onChange({ description: "", descriptionEdited: false });
    else onChange({ description: value, descriptionEdited: true });
  };

  const regenerate = () => {
    setUndo(draft.description);
    onChange({ description: sentenceFor(draft.categoryId, lang, draft.selectedJobIds), descriptionEdited: false });
  };

  const review = () => {
    const e: string[] = [];
    if (!draft.homeownerName.trim()) e.push("request.errorName");
    if (!draft.community.trim()) e.push("request.errorCommunity");
    if (!draft.description.trim()) e.push("request.errorDescription");
    if (draft.photos < 1 && !draft.emergency) e.push("request.errorPhoto");
    if (!draft.street.trim()) e.push("request.errorStreet");
    setErrors(e);
    if (e.length === 0) onReview();
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("request.title")}</h2>
      <p className="text-sm text-inkSoft">{t("request.profileHint")}</p>
      <Field label={t("request.homeownerName")}>
        <input className={inputClass} autoComplete="name" value={draft.homeownerName} onChange={(e) => onChange({ homeownerName: e.target.value })} />
      </Field>
      <Field label={t("request.community")}>
        <input className={inputClass} autoComplete="address-level3" value={draft.community} onChange={(e) => onChange({ community: e.target.value })} />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold">{t("request.quoteFacts")}</legend>
        <p className="text-sm text-inkSoft">{t("request.quoteFactsHint")}</p>
        <Field label={t("request.cleaningSize")}>
          <select className={inputClass} value={draft.cleaningTier} onChange={(e) => onChange({ cleaningTier: e.target.value })}>
            {draft.cleaningTier === "" && <option value="">{t("request.cleaningSizeUnset")}</option>}
            {cleaningAreaTiers().map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
        </Field>
        <Field label={t("request.minisplits")} hint={t("request.minisplitHint")}>
          <input className={inputClass} inputMode="numeric" min={0} step={1} type="number" value={draft.minisplits} onChange={(e) => onChange({ minisplits: countFrom(e.target.value) })} />
        </Field>
        <Field label={t("request.bathrooms")}>
          <input className={inputClass} inputMode="numeric" min={0} step={1} type="number" value={draft.bathrooms} onChange={(e) => onChange({ bathrooms: countFrom(e.target.value) })} />
        </Field>
        <Field label={t("request.bedrooms")}>
          <input className={inputClass} inputMode="numeric" min={0} step={1} type="number" value={draft.bedrooms} onChange={(e) => onChange({ bedrooms: countFrom(e.target.value) })} />
        </Field>
      </fieldset>
      <Field label={t("request.category")}>
        <select className={inputClass} value={draft.categoryId} onChange={(e) => {
          const categoryId = e.target.value;
          setUndo(null);
          if (draft.descriptionEdited) onChange({ categoryId, selectedJobIds: [] });
          else onChange({ categoryId, selectedJobIds: [], description: "" });
        }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.names[lang]}</option>)}
        </select>
      </Field>
      <div className="flex flex-col gap-1">
        <h3 id="request-jobs-heading" className="font-semibold">{t("request.jobs")}</h3>
        <p className="text-sm text-inkSoft">{t("request.jobsHint")}</p>
        <JobChips key={draft.categoryId} headingId="request-jobs-heading" jobs={options} selectedIds={draft.selectedJobIds} onChange={onJobs} />
      </div>
      <Field label={t("request.description")} hint={t("request.descriptionHint")}>
        <textarea
          className={`${inputClass} min-h-[7rem] py-2`}
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
    </div>
  );
}

export function RequestReview({ draft, onEdit, onSubmit }: { draft: Draft; onEdit: () => void; onSubmit: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const category = categories.find((c) => c.id === draft.categoryId);
  const where = draft.zoneId === "outside" ? t("request.outside") : zoneNames[draft.zoneId];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("review.title")}</h2>
      <dl className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
        <div><dt className="text-sm text-inkSoft">{t("request.homeownerName")}</dt><dd className="font-bold">{draft.homeownerName}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.community")}</dt><dd>{draft.community}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.category")}</dt><dd className="font-bold">{category?.names[lang]}</dd></div>
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
