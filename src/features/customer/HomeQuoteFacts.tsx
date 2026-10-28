import { useTranslation } from "react-i18next";
import type { Draft } from "./session";

/** Read-only home counts on a request. Prices stay on the quote lines; these are not fees. */
export function HomeQuoteFacts({ draft }: { draft: Draft }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-4">
      <p className="font-semibold">{t("request.fromHome")}</p>
      <p>{draft.cleaningTier ? t("request.cleaningSizeUsed", { tier: draft.cleaningTier }) : t("request.cleaningSizeUnset")}</p>
      <p>{t("request.homeCounts", { minisplits: draft.minisplits, bathrooms: draft.bathrooms, bedrooms: draft.bedrooms })}</p>
    </div>
  );
}
