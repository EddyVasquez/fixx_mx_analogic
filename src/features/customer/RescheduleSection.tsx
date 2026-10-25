import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { requestReschedule, rescheduleStatus } from "@/mocks/runtime/rescheduleActors";
import { Button } from "@/ui/Button";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { HlDate } from "@/ui/Highlights";
import { JOB_ID } from "./session";

/** Free until the professional is on the way. The current time stays booked until the professional accepts. */
export function RescheduleSection({ rt, lang }: { rt: DemoRuntime; lang: Lang }) {
  const { t } = useTranslation();
  const [hours, setHours] = useState<number>(config.scheduleSlotHours[1] ?? 54);
  const [error, setError] = useState<string | null>(null);
  const rs = rescheduleStatus(rt, JOB_ID);
  const when = (d: Date) => formatDateTime(d, localeFor[lang]);
  const slot = (h: number) => new Date(Math.ceil((rt.clock.now().getTime() + h * 3_600_000) / 3_600_000) * 3_600_000);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h3 className="text-lg font-bold">{t("resched.title")}</h3>
      {rs.status === "pending" && rs.proposedStart && rs.expiresAt ? (
        <>
          <p><HlDate>{t("resched.proposed", { when: when(rs.proposedStart) })}</HlDate></p>
          <p>{t("resched.pending", { when: when(rs.expiresAt) })}</p>
        </>
      ) : (
        <>
          {rs.status === "declined" && <p className="font-semibold">{t("resched.declined")}</p>}
          <p className="text-inkSoft">{t("resched.intro")}</p>
          <Field label={t("schedule.label")}>
            <select className={inputClass} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {config.scheduleSlotHours.map((h) => <option key={h} value={h}>{when(slot(h))}</option>)}
            </select>
          </Field>
          {error && <ErrorText>{error}</ErrorText>}
          <Button variant="secondary" onClick={() => { const r = requestReschedule(rt, JOB_ID, slot(hours)); setError(r.ok ? null : r.error ?? null); }}>{t("btn.requestTime")}</Button>
        </>
      )}
    </section>
  );
}
