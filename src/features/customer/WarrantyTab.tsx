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
import { useDemoMode } from "./demoMode";
import { demoWarrantyViews, type DemoWarrantyView } from "./demoSamples";
import { JOB_ID, session } from "./session";
import { TradeName } from "./tradeIcons";

/** Warranty dashboard, detail and claim. Warranty claims are a different flow from issue reports. */
export function WarrantyTab({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const demoOn = useDemoMode();
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const a = rt.get(`warranty:${JOB_ID}`);
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const samples = demoOn ? demoWarrantyViews(rt.clock.now(), lang) : [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("warranty.title")}</h2>
      {samples.length > 0 && (
        <ul className="flex flex-col gap-3">
          {samples.map((item) => <DemoWarrantyRow key={item.id} lang={lang} item={item} when={when} />)}
        </ul>
      )}
      {!a && samples.length === 0 && <p className="glass p-4">{t("warranty.empty")}</p>}
      {a && <LiveWarranty lang={lang} note={note} error={error} setNote={setNote} setError={setError} />}
    </div>
  );
}

function DemoWarrantyRow({ lang, item, when }: { lang: Lang; item: DemoWarrantyView; when: (d: Date) => string }) {
  const { t } = useTranslation();
  const category = categories.find((entry) => entry.id === item.categoryId);
  const chip = item.claimInProgress
    ? t("demo.warranty.claim")
    : item.expiringSoon
      ? t("demo.warranty.expiring")
      : t("myhome.hub.warrantyState.active");
  return (
    <li data-demo-warranty={item.id} className="glass flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded bg-warnBg px-1.5 py-0.5 text-xs font-semibold text-warnInk">{t("demo.badge")}</span>
        <p className="inline-flex w-fit max-w-full items-center break-words rounded-full border border-line bg-mist px-3 py-1 font-semibold">{chip}</p>
      </div>
      <p className="text-lg font-bold"><TradeName categoryId={item.categoryId} lang={lang} /></p>
      <p className="break-words">{item.title}</p>
      <p className="break-words">{t("myhome.entry", { category: category?.names[lang] ?? "", professional: item.professionalName })}</p>
      <p className="break-words">{t("demo.warranty.ends", { date: when(item.endsAt) })}</p>
      <p className="text-sm">{t("warranty.daysLeft", { days: item.daysLeft })}</p>
    </li>
  );
}

function LiveWarranty({ lang, note, error, setNote, setError }: {
  lang: Lang;
  note: string;
  error: boolean;
  setNote: (value: string) => void;
  setError: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const a = rt.get(`warranty:${JOB_ID}`);
  if (!a) return null;
  const c = a.snap.ctx as WarrantyCtx;
  const st = a.snap.state as WarrantyState;
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const daysLeft = Math.max(Math.ceil((c.endsAt.getTime() - rt.clock.now().getTime()) / 86_400_000), 0);

  return (
    <>
      <section className="glass flex flex-col gap-2 p-4">
        <p className="text-lg font-bold"><TradeName categoryId={session.draft.categoryId} lang={lang} /></p>
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
          <p className="text-sm text-inkSoft">{t("claim.different", { issueHours: config.completionCheck.autoReleaseHours })}</p>
          <Field label={t("claim.description")}>
            <textarea className={`${inputClass} min-h-[6rem] py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <ErrorText>{t("claim.needDescription")}</ErrorText>}
          <Button onClick={() => { if (!note.trim()) return setError(true); setError(false); setNote(""); rt.dispatch(a.id, { type: "FILE_CLAIM" }); }}>{t("btn.fileClaim")}</Button>
        </section>
      )}
      <WarrantyAgentDemo rt={rt} jobId={JOB_ID} />
    </>
  );
}
