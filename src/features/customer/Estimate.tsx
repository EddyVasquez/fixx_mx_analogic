import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { useMoney } from "@/features/shared/Money";
import { estimateRange } from "@/core/pricing/quote";
import type { Draft } from "./session";

export function EstimateView({ draft, onNext }: { draft: Draft; onNext: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const r = estimateRange(draft.categoryId, draft.emergency);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("estimate.title")}</h2>
      <p className="text-3xl font-bold"><DemoValue>{t("estimate.range", { low: money(r.low), high: money(r.high) })}</DemoValue></p>
      {r.surcharge > 0 && <p className="font-semibold"><DemoValue>{t("estimate.urgent", { amount: money(r.surcharge) })}</DemoValue></p>}
      <p className="text-inkSoft">{t("estimate.note")}</p>
      <Button onClick={onNext}>{t("btn.seeProfessionals")}</Button>
    </div>
  );
}
