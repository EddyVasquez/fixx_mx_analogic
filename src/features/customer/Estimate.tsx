import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { useMoney } from "@/features/shared/Money";
import { estimateRange, humanReviewForCategory } from "@/core/pricing/quote";
import { HomeQuoteFacts } from "./HomeQuoteFacts";
import { quoteScopeFromDraft } from "./homeModel";
import type { Draft } from "./session";
import { PendingReviewBanner } from "./PendingReviewBanner";

export function EstimateView({ draft, onNext }: { draft: Draft; onNext: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const r = estimateRange(draft.categoryId, draft.emergency, quoteScopeFromDraft(draft));
  const needsReview = humanReviewForCategory(draft.categoryId).length > 0;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {needsReview && <PendingReviewBanner />}
      <h2 className="text-2xl font-bold">{t("estimate.title")}</h2>
      <p className="min-w-0 break-words text-3xl font-bold"><DemoValue>{t("estimate.range", { low: money(r.low), high: money(r.high) })}</DemoValue></p>
      {r.surcharge > 0 && <p className="font-semibold"><DemoValue>{t("estimate.urgent", { amount: money(r.surcharge) })}</DemoValue></p>}
      <HomeQuoteFacts draft={draft} />
      <p className="text-inkSoft">{t("estimate.note")}</p>
      <Button onClick={onNext}>{t("btn.seeProfessionals")}</Button>
    </div>
  );
}
