import { useTranslation } from "react-i18next";
import type { JobState } from "@/core/machines";
import { Button } from "@/ui/Button";

const NEXT: Partial<Record<JobState, string>> = {
  professionalSelected: "SEND_QUOTE", scheduled: "ON_THE_WAY", onTheWay: "CHECK_IN",
  checkedIn: "START_WORK", inProgress: "CHECKLIST_COMPLETE", checklistComplete: "MARK_COMPLETE"
};

/** Demo-only: lets one person play the professional's side until the professional app exists (Step 7). */
export function ProSimulator({ state, onEvent }: { state: JobState; onEvent: (type: string) => void }) {
  const { t } = useTranslation();
  const next = NEXT[state];
  if (!next) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
      <p className="text-sm font-semibold">{t("demo.proActing")}</p>
      <Button variant="secondary" onClick={() => onEvent(next)}>{t(`demo.pro.${next}`)}</Button>
    </div>
  );
}
