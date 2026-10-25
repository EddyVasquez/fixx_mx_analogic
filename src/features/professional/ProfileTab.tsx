import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProLike } from "@/core/matching/recommend";
import { isValidClabe } from "@/core/rules";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { ratings } from "@/features/customer/session";
import { useRuntime } from "@/demo/runtime";
import { psession } from "./session";

type Send = (e: { type: string }) => void;

export function ProfileTab({ me, penalties, sendVerification, rerender }: { me: ProLike | undefined; penalties: number; sendVerification: Send; rerender: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const rt = useRuntime();
  const scoreDelta = rt.scoreChanges.filter((c) => c.professionalId === me?.id).reduce((s, c) => s + c.delta, 0);
  const mine = ratings.filter((r) => r.proId === me?.id);
  const avg = mine.length ? (mine.reduce((s, r) => s + (r.values["overall"] ?? 0), 0) / mine.length).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
        <p className="text-xl font-bold">{me?.name}</p>
        {me?.level && <p><span className="text-sm text-inkSoft">{t("dash.level")}: </span><b>{t(`level.${me.level}`)}</b></p>}
        <p className="text-sm text-inkSoft">{t("dash.levelsNote")}</p>
        <p><span className="text-sm text-inkSoft">{t("dash.score")}: </span><b>{me?.qualityScore == null ? "—" : me.qualityScore + scoreDelta}</b></p>
        {me?.qualityScore == null && <p className="text-sm">{t("dash.noScore")}</p>}
        <p className="text-sm text-inkSoft">{t("dash.scoreNote")}</p>
        {penalties > 0 && <p className="font-semibold">{t("dash.penalties", { count: penalties })}</p>}
      </section>

      <section className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-4">
        <h3 className="font-bold">{t("dash.rating")}</h3>
        <p>{avg ? t("dash.ratingAvg", { avg, count: mine.length }) : t("dash.noRatings")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
        <h3 className="font-bold">{t("payout.title")}</h3>
        <Field label={t("payout.clabe")}>
          <input className={inputClass} inputMode="numeric" value={psession.clabe} onChange={(e) => { psession.clabe = e.target.value; psession.clabeSaved = false; rerender(); }} />
        </Field>
        {error && <ErrorText>{t("payout.invalid")}</ErrorText>}
        {psession.clabeSaved && <p role="status" className="font-semibold">{t("payout.saved")}</p>}
        <p className="text-sm"><DemoValue>{t("payout.draftNote")}</DemoValue></p>
        <Button variant="secondary" onClick={() => { if (!isValidClabe(psession.clabe)) return setError(true); setError(false); psession.clabeSaved = true; rerender(); }}>{t("btn.saveAccount")}</Button>
      </section>

      <Button variant="secondary" onClick={() => sendVerification({ type: "REPORT_LOST_NUMBER" })}>{t("btn.lostNumber")}</Button>
    </div>
  );
}
