import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { useMoney } from "@/features/shared/Money";
import { clock } from "@/core/clock/clock";
import { isAgentHours } from "@/core/rules";
import { categories, zoneNames, zones } from "./data";
import type { Draft } from "./session";

export function RequestBuilder({ draft, onChange, onReview }: { draft: Draft; onChange: (p: Partial<Draft>) => void; onReview: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const money = useMoney();
  const [errors, setErrors] = useState<string[]>([]);

  const review = () => {
    const e: string[] = [];
    if (!draft.description.trim()) e.push("request.errorDescription");
    if (draft.photos < 1 && !draft.emergency) e.push("request.errorPhoto");
    if (!draft.street.trim()) e.push("request.errorStreet");
    setErrors(e);
    if (e.length === 0) onReview();
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("request.title")}</h2>
      <Field label={t("request.category")}>
        <select className={inputClass} value={draft.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.names[lang]}</option>)}
        </select>
      </Field>
      <Field label={t("request.description")} hint={t("request.descriptionHint")}>
        <textarea className={`${inputClass} min-h-[7rem] py-2`} value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
      </Field>

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
            <p className="text-sm"><DemoValue>{t("request.emergencyNote", { amount: money(config.emergencySurchargeMXN) })}</DemoValue></p>
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
        <div><dt className="text-sm text-inkSoft">{t("request.category")}</dt><dd className="font-bold">{category?.names[lang]}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.description")}</dt><dd>{draft.description}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.photos")}</dt><dd>{draft.photos === 0 ? t("request.noPhotos") : t("request.photoCount", { count: draft.photos })}</dd></div>
        {draft.measurements && <div><dt className="text-sm text-inkSoft">{t("request.measurements")}</dt><dd>{draft.measurements}</dd></div>}
        <div><dt className="text-sm text-inkSoft">{t("request.address")}</dt><dd>{where}, {draft.street}</dd></div>
        {draft.emergency && <div><dd className="font-bold">{t("request.emergency")}</dd></div>}
      </dl>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onEdit}>{t("btn.edit")}</Button>
        <Button className="flex-1" onClick={onSubmit}>{t("btn.submitRequest")}</Button>
      </div>
    </div>
  );
}
