import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { buildSchedule, type PayMethod } from "@/core/rules";
import { localeFor } from "@/i18n";
import { cashReference, speiDetails } from "@/mocks/payments/gateway";
import { HlDate } from "@/ui/Highlights";
import { useMoney } from "@/features/shared/Money";

/** Exact deadlines and what happens if one is missed. For cards, the charge timing instead. */
export function PaymentSchedule({ method, total, jobStart, basis, only, formatAmount }: {
  method: PayMethod; total: number; jobStart: Date; basis: Date; only?: "deposit" | "balance" | "full";
  /** Payment screen passes the customer amount format. Other screens keep the shared formatter. */
  formatAmount?: (amount: number) => string;
}) {
  const { t, i18n } = useTranslation();
  const fallbackMoney = useMoney();
  const money = formatAmount ?? fallbackMoney;
  const lang = i18n.language as Lang;
  if (method === "card" || method === "wallet") return <p>{t("quote.cardTiming")}</p>;
  const lines = buildSchedule({ method, total, jobStart, now: basis }).installments.filter((i) => !only || i.kind === only);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">{t("schedule.title")}</h3>
      <ul className="flex flex-col gap-2">
        {lines.map((i) => (
          <li key={i.kind} className="flex flex-col gap-1">
            <span><HlDate>{t("schedule.line", { label: t(`installment.${i.kind}`), amount: money(i.amount), when: i.dueAt ? formatDateTime(i.dueAt, localeFor[lang]) : "" })}</HlDate></span>
            {i.onMissed && <span className="text-sm">{t(`consequence.${i.onMissed}`)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The cash reference or SPEI account for one installment. */
export function ReferenceBox({ method, id }: { method: "cash" | "spei"; id: string }) {
  const { t } = useTranslation();
  if (method === "cash") {
    return (
      <div className="flex flex-col gap-1 rounded-2xl border-2 border-ink bg-paper p-3">
        <p className="text-sm">{t("pay.cashHow")}</p>
        <p className="text-xl font-bold">{t("pay.cashRef", { reference: cashReference(id) })}</p>
      </div>
    );
  }
  const s = speiDetails(id);
  return (
    <div className="flex flex-col gap-1 rounded-2xl border-2 border-ink bg-paper p-3">
      <p className="text-sm">{t("pay.speiHow")}</p>
      <p className="font-bold">{t("pay.speiClabe", { clabe: s.clabe })}</p>
      <p>{t("pay.speiConcept", { concept: s.concept })}</p>
      <p>{t("pay.speiBeneficiary", { beneficiary: s.beneficiary })}</p>
    </div>
  );
}
