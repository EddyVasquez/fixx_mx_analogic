import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { splitDepositBalance, type PayMethod } from "@/core/rules";
import type { JobCtx } from "@/core/machines";
import { languageNames, localeFor } from "@/i18n";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { HlAmount, HlDate, HlOk, Label } from "@/ui/Highlights";
import { useMoney } from "@/features/shared/Money";
import { PaymentSchedule } from "./PaymentSchedule";
import { categories } from "./data";
import type { Draft } from "./session";
import { PendingReviewBanner } from "./PendingReviewBanner";

const Row = ({ left, right }: { left: ReactNode; right: ReactNode }) => (
  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-inkSoft/40 py-3">
    <div className="min-w-0 break-words">{left}</div>
    <div className="min-w-0 break-words text-right">{right}</div>
  </div>
);
const Note = ({ children }: { children: ReactNode }) => <p className="border-b border-inkSoft/40 pb-3 text-sm">{children}</p>;

/** The quote as a grey work order: black field labels, highlights only on what matters. */
export function QuoteView(props: {
  ctx: JobCtx; draft: Draft; professionalName: string; now: Date;
  slotHours: number; method: PayMethod; onSlot: (h: number) => void; onMethod: (m: PayMethod) => void;
  onAccept: (jobStart: Date) => void;
  awaitingApproval?: boolean;
}) {
  const { ctx, draft, professionalName, now, slotHours, method } = props;
  const awaitingApproval = props.awaitingApproval === true;
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const money = useMoney();
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(false);

  const slot = (h: number) => new Date(Math.ceil((now.getTime() + h * 3_600_000) / 3_600_000) * 3_600_000);
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const { deposit, balance } = splitDepositBalance(ctx.total);
  const pct = config.deposit.sharePct;
  const category = categories.find((c) => c.id === draft.categoryId);
  const warranty = config.warrantyDaysByCategory[draft.categoryId] ?? 0;
  const slotList = draft.emergency ? config.emergencySlotHours : config.scheduleSlotHours;
  const hoursSel = slotList.includes(slotHours) ? slotHours : slotList[0]!;

  const accept = () => {
    if (!name.trim() || !ok) return setError(true);
    setError(false);
    props.onAccept(slot(hoursSel));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {awaitingApproval && <PendingReviewBanner />}
      <h2 className="text-2xl font-bold">{t("quote.title")}</h2>
      <section aria-label={t("quote.title")} className="rounded-3xl bg-panel px-4 py-1 text-ink">
        <Row left={<Label>{t("quote.label.job")}</Label>} right={category?.names[lang]} />
        <Row left={<Label>{t("quote.label.professional")}</Label>} right={professionalName} />
        <Note>{t("quote.identityNote")}</Note>
        <Row left={<Label>{t("quote.label.date")}</Label>} right={<HlDate>{when(slot(hoursSel))}</HlDate>} />
        {ctx.lines.map((l) => <Row key={l.id} left={t(`quote.line.${l.id}`)} right={money(l.amount)} />)}
        <Row left={<HlAmount>{t("quote.label.total")}</HlAmount>} right={<b>{money(ctx.total)}</b>} />
        <Row left={<HlAmount>{t("quote.label.deposit", { pct })}</HlAmount>} right={money(deposit)} />
        <Row left={<HlAmount>{t("quote.label.balance", { pct: 100 - pct })}</HlAmount>} right={money(balance)} />
        <div className="border-b border-inkSoft/40 py-3 text-sm"><PaymentSchedule method={method} total={ctx.total} jobStart={slot(hoursSel)} basis={now} /></div>
        <Row left={<HlOk>{t("quote.label.travelFee")}</HlOk>} right={<DemoValue>{money(ctx.travelFee)}</DemoValue>} />
        <Note>{t("quote.travelTerms")}</Note>
        <Row left={<Label>{t("quote.label.warranty")}</Label>} right={<DemoValue>{t("quote.warrantyDays", { days: warranty })}</DemoValue>} />
        <Row left={<Label>{t("quote.label.language")}</Label>} right={languageNames[lang]} />
        <p className="flex flex-wrap items-center gap-2 py-3 text-sm">
          <span>{t("quote.key")}:</span><HlAmount>{t("quote.keyAmounts")}</HlAmount><HlOk>{t("quote.keyOk")}</HlOk><HlDate>{t("quote.keyDates")}</HlDate>
        </p>
      </section>

      {ctx.carryOver > 0 && (
        <p className="rounded-2xl border-2 border-ink p-3 font-semibold">
          {deposit - ctx.carryOver > 0
            ? t("quote.carryMore", { paid: money(ctx.carryOver), difference: money(deposit - ctx.carryOver) })
            : t("quote.carryCovered", { paid: money(ctx.carryOver), deposit: money(deposit) })}
        </p>
      )}
      <Field label={t("schedule.label")}>
        <select className={inputClass} value={hoursSel} onChange={(e) => props.onSlot(Number(e.target.value))}>
          {slotList.map((h) => <option key={h} value={h}>{when(slot(h))}</option>)}
        </select>
      </Field>
      <Field label={t("payment.method")}>
        <select className={inputClass} value={method} onChange={(e) => props.onMethod(e.target.value as PayMethod)}>
          {(["card", "wallet", "cash", "spei"] as const).map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
        </select>
      </Field>
      <Field label={t("sign.name")}>
        <input className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <label className="flex min-h-touch items-center gap-3">
        <input type="checkbox" className="h-6 w-6" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        {t("sign.accept")}
      </label>
      <p className="text-sm text-inkSoft">{t("sign.nonLegal")}</p>
      {error && <ErrorText>{t("sign.error")}</ErrorText>}
      <Button
        aria-disabled={awaitingApproval}
        aria-describedby={awaitingApproval ? "pending-review-banner" : undefined}
        className={awaitingApproval ? "opacity-80" : ""}
        onClick={() => { if (awaitingApproval) return; accept(); }}
      >
        {awaitingApproval ? t("btn.waitingApproval") : t("btn.acceptQuote")}
      </Button>
    </div>
  );
}
