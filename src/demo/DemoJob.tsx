import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { addHours, type PayMethod } from "@/core/rules";
import { allowedEvents, jobMachine, newJobCtx, statusFor, type JobCtx, type JobState } from "@/core/machines";
import { JobStatusBar } from "@/features/shared/JobStatusBar";
import { Button } from "@/ui/Button";
import { languageNames, localeFor } from "@/i18n";
import { runtime, useRuntime } from "./runtime";
import { closeIssueWindow } from "@/features/customer/closeIssueWindow";

const JOB = "job-1";
const LINES = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "paint", amount: 2200 }];
const METHODS: PayMethod[] = ["card", "wallet", "cash", "spei"];

export function DemoJob() {
  const { t, i18n } = useTranslation();
  const rt = useRuntime();
  const appLang = i18n.language as Lang;
  const [method, setMethod] = useState<PayMethod>("card");
  const [hours, setHours] = useState(72);
  const [customerLang, setCustomerLang] = useState<Lang>(appLang);
  const [proLang, setProLang] = useState<Lang>("es");
  const [error, setError] = useState<string | null>(null);
  const actor = rt.get(JOB);
  const field = "min-h-touch rounded-lg border border-line bg-paper px-3 text-base font-normal";

  const start = () => {
    runtime.reset();
    runtime.languages.customer = customerLang;
    runtime.languages.professional = proLang;
    runtime.spawn(JOB, "job", jobMachine, newJobCtx({ professionalId: "p2" }), { categoryId: "painting" });
    setError(null);
  };
  const fire = (type: string) => {
    if (type === "WINDOW_CLOSED") {
      const res = closeIssueWindow(rt, JOB);
      setError(res.ok ? null : t("timeline.closeFailed"));
      return;
    }
    const ctx = actor?.snap.ctx as JobCtx | undefined;
    const now = rt.clock.now();
    const payloads: Record<string, object> = {
      SELECT_PROFESSIONAL: { professionalId: "p2" },
      SEND_QUOTE: { total: 4200, travelFee: config.travelFeeBandsMXN.adjacent, payoutRatio: 0.8, lines: LINES },
      ACCEPT_QUOTE: { method, jobStart: addHours(now, hours) },
      PAYMENT_SATISFIED: { amount: ctx ? Math.max(ctx.initialDue - ctx.paid, 1) : 1 },
      RESCHEDULE_ACCEPTED: { newStart: addHours(now, hours + 48) },
      REQUEST_ADDITIONAL_WORK: { amount: 500 },
      REPORT_ISSUE: { selected: "wholeJob" }
    };
    const res = rt.dispatch(JOB, { type, ...(payloads[type] ?? {}) });
    setError(res.ok ? null : res.error ?? null);
  };

  const state = actor?.snap.state as JobState | undefined;
  const status = state ? statusFor(state) : null;
  const timers = rt.scheduler.list(JOB);

  return (
    <section aria-labelledby="demojob-title" className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h2 id="demojob-title" className="text-lg font-bold">{t("demoJob.title")}</h2>
      <p className="text-sm text-inkSoft">{t("demoJob.devNote")}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("demoJob.method")}
          <select className={field} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("demoJob.hoursAway")}
          <select className={field} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {[72, 36, 10].map((h) => <option key={h} value={h}>{t("demoJob.hoursOption", { hours: h })}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("demoJob.customerLanguage")}
          <select className={field} value={customerLang} onChange={(e) => setCustomerLang(e.target.value as Lang)}>
            {config.languages.map((l) => <option key={l} value={l}>{languageNames[l]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("demoJob.professionalLanguage")}
          <select className={field} value={proLang} onChange={(e) => setProLang(e.target.value as Lang)}>
            {config.languages.map((l) => <option key={l} value={l}>{languageNames[l]}</option>)}
          </select>
        </label>
      </div>
      <Button onClick={start}>{t("btn.newJob")}</Button>

      {state && (status ? <JobStatusBar status={status} /> : <p className="rounded-2xl border-2 border-ink p-3 font-bold">{t(`state.${state}`)}</p>)}

      {state && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("demoJob.next")}</h3>
          {allowedEvents(jobMachine, state).length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-inkSoft">{t("demoJob.finished")}</p>
              <Button onClick={start}>{t("btn.startOver")}</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowedEvents(jobMachine, state).map((type) => (
                <Button key={type} variant="secondary" className="text-sm" onClick={() => fire(type)}><code>{type}</code></Button>
              ))}
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}

      {actor && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t("demoJob.deadlines")}</h3>
          {timers.length === 0 ? <p className="text-sm text-inkSoft">{t("demoJob.none")}</p> : (
            <ul className="text-sm">
              {timers.map((tm) => <li key={tm.id}><code>{tm.event.type}</code>: {formatDateTime(tm.at, localeFor[appLang])}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
