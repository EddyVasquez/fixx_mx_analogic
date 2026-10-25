import { useTranslation } from "react-i18next";
import type { JobState } from "@/core/machines";
import { Button } from "@/ui/Button";
import { useMoney } from "@/features/shared/Money";

/** After a professional cancels, does not show up, or does not answer a reschedule: replacement or full refund. */
export function ChoiceView({ state, paid, onReplace, onRefund }: { state: JobState; paid: number; onReplace: () => void; onRefund: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl border-2 border-ink p-3 font-bold">{t(`state.${state}`)}</p>
      <h2 className="text-2xl font-bold">{t("choice.title")}</h2>
      <p>{t("choice.body", { paid: money(paid) })}</p>
      <Button onClick={onReplace}>{t("btn.chooseReplacement")}</Button>
      <Button variant="secondary" onClick={onRefund}>{t("btn.getRefund")}</Button>
    </div>
  );
}
