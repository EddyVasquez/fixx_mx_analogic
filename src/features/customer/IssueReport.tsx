import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { computeHeld } from "@/core/rules";
import type { JobCtx } from "@/core/machines";
import { Button } from "@/ui/Button";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { useMoney } from "@/features/shared/Money";
import { JobPhotos, usePhotoQueue } from "@/features/shared/JobPhotos";

/** Problem report inside the completion window. A category, a description and one photo are required. Only the picked amount is held. */
export function IssueReport({ ctx, now, lang, onSubmit }: {
  ctx: JobCtx; now: Date; lang: Lang;
  onSubmit: (selected: string[] | "wholeJob", description: string, category: string, photoCount: number) => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const queue = usePhotoQueue();
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const photos = queue.count("problem");

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>{t("btn.reportProblem")}</Button>;

  const held = computeHeld({ lines: ctx.lines, selected: whole ? "wholeJob" : picked, jobTotal: ctx.total, payoutRatio: ctx.payoutRatio }).held;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const submit = () => {
    if (!category) return setError("problem.needCategory");
    if (!whole && picked.length === 0) return setError("issue.needItem");
    if (!desc.trim()) return setError("issue.needDescription");
    if (photos < config.completionCheck.minProblemPhotos) return setError("problem.needPhoto");
    setError(null);
    onSubmit(whole ? "wholeJob" : picked, desc.trim(), category, photos);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
      <h3 className="text-lg font-bold">{t("issue.title")}</h3>
      <p className="text-inkSoft">{t("issue.intro")}</p>
      <Field label={t("problem.category")}>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("problem.needCategory")}</option>
          {config.completionCheck.problemCategories.map((id) => (
            <option key={id} value={id}>{t(`problem.cat.${id}`)}</option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-semibold">{t("issue.itemsLegend")}</legend>
        <label className="flex min-h-touch items-center gap-3 font-semibold">
          <input type="checkbox" className="h-6 w-6" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
          {t("issue.wholeJob")}
        </label>
        {ctx.lines.map((l) => (
          <label key={l.id} className="flex min-h-touch items-center gap-3">
            <input type="checkbox" className="h-6 w-6" disabled={whole} checked={whole || picked.includes(l.id)} onChange={() => toggle(l.id)} />
            <span className="flex-1">{t(`quote.line.${l.id}`)}</span>
            <span>{money(l.amount)}</span>
          </label>
        ))}
      </fieldset>
      <p className="font-bold" aria-live="polite">{t("issue.heldPreview", { held: money(held) })}</p>
      <Field label={t("issue.description")}>
        <textarea className={`${inputClass} min-h-[6rem] py-2`} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <JobPhotos phase="problem" label={t("problem.photo")} addLabel={t("btn.addProblemPhoto")} min={config.completionCheck.minProblemPhotos} now={now} lang={lang} />
      <p className="text-sm text-inkSoft">{t("issue.separate", { issueHours: config.completionCheck.autoReleaseHours })}</p>
      {error && <ErrorText>{t(error)}</ErrorText>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>{t("btn.back")}</Button>
        <Button className="flex-1" onClick={submit}>{t("btn.sendReport")}</Button>
      </div>
    </section>
  );
}
