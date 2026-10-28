import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { buildQuote } from "@/core/pricing/quote";
import { HomeQuoteFacts } from "@/features/customer/HomeQuoteFacts";
import { quoteScopeFromDraft } from "@/features/customer/homeModel";
import { adjustQuote, payoutLimits } from "@/core/pricing/adjust";
import { bandFor, travelFeeFor } from "@/core/rules";
import type { ProLike } from "@/core/matching/recommend";
import { languageNames } from "@/i18n";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { useMoney } from "@/features/shared/Money";
import { TranslatedText } from "@/features/shared/TranslatedText";
import { categories, zoneNames, zones } from "@/features/customer/data";
import type { Draft } from "@/features/customer/session";

type Send = (e: { type: string } & Record<string, unknown>) => void;

/** Job request details and the quote form. Professionals see payouts only: the customer's total is never shown here. */
export function JobRequest({ draft, me, customerLang, viewerLang, send }: { draft: Draft; me: ProLike; customerLang: Lang; viewerLang: Lang; send: Send }) {
  const { t } = useTranslation();
  const money = useMoney();
  const base = buildQuote(draft.categoryId, draft.emergency, quoteScopeFromDraft(draft));
  const suggested = base.payout;
  const bounds = payoutLimits(suggested, base.wageFloor);
  const [payout, setPayout] = useState(String(suggested));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const category = categories.find((c) => c.id === draft.categoryId);
  const fee = travelFeeFor(bandFor(me.zoneId, draft.zoneId, zones));

  const submit = () => {
    const value = Number(payout.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) return setError("pquote.outOfLimits");
    if (Math.abs(value - suggested) > 0.005 && !reason.trim()) return setError("pquote.reasonNeeded");
    const q = adjustQuote(base, value);
    setError(null);
    // The job still stores this release ratio until the labor payout itself is saved. It is not used to price the quote.
    send({ type: "SEND_QUOTE", total: q.total, travelFee: fee, payoutRatio: config.demoPayoutRatio, lines: q.lines, taskId: base.taskId, tier: base.tier, ...(reason.trim() ? { adjustmentReason: reason.trim() } : {}) });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("job.request.title")}</h2>
      <dl className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
        <div><dt className="text-sm text-inkSoft">{t("request.homeownerName")}</dt><dd className="font-bold">{draft.homeownerName}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.community")}</dt><dd>{draft.community}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.street")}</dt><dd>{draft.street}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.category")}</dt><dd className="font-bold">{category?.names[viewerLang]}</dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.description")}</dt><dd><TranslatedText text={draft.description} from={customerLang} to={viewerLang} /></dd></div>
        <div><dt className="text-sm text-inkSoft">{t("request.photos")}</dt><dd>{draft.photos === 0 ? t("request.noPhotos") : t("request.photoCount", { count: draft.photos })}</dd></div>
        {draft.measurements && <div><dt className="text-sm text-inkSoft">{t("request.measurements")}</dt><dd><TranslatedText text={draft.measurements} from={customerLang} to={viewerLang} /></dd></div>}
        <div><dt className="text-sm text-inkSoft">{t("job.where")}</dt><dd>{draft.zoneId === "outside" ? t("request.outside") : zoneNames[draft.zoneId]}</dd></div>
        {draft.emergency && <div><dd className="font-bold">{t("request.emergency")}</dd></div>}
      </dl>
      <HomeQuoteFacts draft={draft} />

      <h3 className="text-xl font-bold">{t("pquote.title")}</h3>
      <p className="font-semibold">{t("pquote.suggested", { amount: money(suggested) })}</p>
      <Field label={t("pquote.yourPayout")}>
        <input className={inputClass} inputMode="decimal" value={payout} onChange={(e) => setPayout(e.target.value)} />
      </Field>
      <p className="text-sm"><DemoValue>{t("pquote.limits", { min: money(bounds.min), max: money(bounds.max) })}</DemoValue></p>
      <Field label={t("pquote.reason")}>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="text-sm text-inkSoft"><DemoValue>{t("pquote.travel", { amount: money(fee) })}</DemoValue></p>
      <p className="text-sm text-inkSoft">{t("translation.officialNote", { language: languageNames[customerLang] })}</p>
      {error && <ErrorText>{t(error)}</ErrorText>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => send({ type: "PROFESSIONAL_DECLINES" })}>{t("btn.decline")}</Button>
        <Button className="flex-1" onClick={submit}>{t("btn.sendQuote")}</Button>
      </div>
    </div>
  );
}
