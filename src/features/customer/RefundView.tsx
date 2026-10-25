import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import type { RefundRecord } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { useMoney } from "@/features/shared/Money";

/** Refunds: cards and wallets go back to the original method; cash and SPEI need a CLABE from the customer. */
export function RefundView({ refund, issued, onClabe, onAuto, onStartOver, hideStartOver }: { refund: RefundRecord; issued: boolean; onClabe: (clabe: string) => boolean; onAuto: () => void; onStartOver: () => void; hideStartOver?: boolean }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const lang = i18n.language as Lang;
  const [clabe, setClabe] = useState("");
  const [error, setError] = useState(false);
  const date = formatDateTime(new Date(refund.expectedBy), localeFor[lang]);
  const needsClabe = refund.destination === "clabe" && !refund.clabe;
  // Refunds to the original method need nothing from the customer.
  useEffect(() => { if (refund.destination === "original" && !issued) onAuto(); });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("refund.title")}</h2>
      <p className="text-2xl font-bold">{t("refund.amount", { amount: money(refund.amount) })}</p>
      {needsClabe ? (
        <>
          <p>{t("refund.clabeIntro")}</p>
          <Field label={t("payout.clabe")}>
            <input className={inputClass} inputMode="numeric" value={clabe} onChange={(e) => setClabe(e.target.value)} />
          </Field>
          {error && <ErrorText>{t("refund.clabeInvalid")}</ErrorText>}
          <Button onClick={() => setError(!onClabe(clabe))}>{t("btn.sendClabe")}</Button>
        </>
      ) : (
        <p role="status" className="font-semibold">{issued ? t("refund.done", { date }) : t(refund.destination === "clabe" ? "refund.done" : "refund.original", { date })}</p>
      )}
      {issued && !hideStartOver && <Button variant="secondary" onClick={onStartOver}>{t("btn.startOver")}</Button>}
    </div>
  );
}
