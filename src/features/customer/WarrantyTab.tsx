import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import type { WarrantyCtx, WarrantyState } from "@/core/machines";
import { localeFor } from "@/i18n";
import { useRuntime } from "@/demo/runtime";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { WarrantyAgentDemo } from "./AgentDemo";
import { categories } from "./data";
import { JOB_ID, session } from "./session";

/** Warranty dashboard, detail and claim. Warranty claims are a different flow from issue reports. */
export function WarrantyTab({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const a = rt.get(`warranty:${JOB_ID}`);
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);

  if (!a) return (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">{t("warranty.title")}</h2>
      <p className="rounded-2xl border border-line bg-paper p-4">{t("warranty.empty")}</p>
    </div>
  );

  const c = a.snap.ctx as WarrantyCtx;
  const st = a.snap.state as WarrantyState;
  const category = categories.find((x) => x.id === session.draft.categoryId);
  const daysLeft = Math.max(Math.ceil((c.endsAt.getTime() - rt.clock.now().getTime()) / 86_400_000), 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("warranty.title")}</h2>
      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
        <p className="text-lg font-bold">{category?.names[lang]}</p>
        {st === "expired"
          ? <p>{t("warranty.endedOn", { date: when(c.endsAt) })}</p>
          : <p><DemoValue>{t("warranty.active", { date: when(c.endsAt) })}</DemoValue></p>}
        {st !== "expired" && <p className="text-sm">{t("warranty.daysLeft", { days: daysLeft })}</p>}
        {(st === "claimFiled" || st === "inReview") && <p className="font-semibold">{t(`claim.status.${st}`)}</p>}
        {st === "running" && c.lastOutcome && <p className="font-semibold">{t(`claim.outcome.${c.lastOutcome}`)}</p>}
        <p className="text-sm text-inkSoft">{t("warranty.terms")}</p>
      </section>

      {st === "running" && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-paper p-4">
          <p className="text-sm text-inkSoft">{t("claim.different", { issueHours: config.issueWindowHours })}</p>
          <Field label={t("claim.description")}>
            <textarea className={`${inputClass} min-h-[6rem] py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <ErrorText>{t("claim.needDescription")}</ErrorText>}
          <Button onClick={() => { if (!note.trim()) return setError(true); setError(false); setNote(""); rt.dispatch(a.id, { type: "FILE_CLAIM" }); }}>{t("btn.fileClaim")}</Button>
        </section>
      )}
      <WarrantyAgentDemo rt={rt} jobId={JOB_ID} />
    </div>
  );
}
