import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config } from "@/core/config/fixx.config";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { closeIssueWindow } from "./closeIssueWindow";

/** Demo next step at the issue window, so the status path does not stop with no choices. */
export function CloseWindowAction({ rt, jobId }: { rt: DemoRuntime; jobId: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
      <p className="text-sm">{t("timeline.closeNote", { hours: config.completionCheck.autoReleaseHours })}</p>
      <Button variant="secondary" onClick={() => setFailed(!closeIssueWindow(rt, jobId).ok)}>{t("btn.closeWindow")}</Button>
      {failed && <p role="alert" className="text-sm font-bold">{t("timeline.closeFailed")}</p>}
    </div>
  );
}
