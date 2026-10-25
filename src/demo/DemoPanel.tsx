import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { clock, formatDateTime } from "@/core/clock/clock";
import type { PayMethod } from "@/core/rules";
import { languageNames, localeFor } from "@/i18n";
import { resetDemo } from "@/mocks/db/seed";
import { JOB_ID, session } from "@/features/customer/session";
import { A11yControl } from "@/ui/A11yControl";
import { Button } from "@/ui/Button";
import { DecisionsPanel } from "./DecisionsPanel";
import { ScenarioRunner } from "./ScenarioRunner";
import { runtime } from "./runtime";
import { ROLES, useRole } from "./roles";
import { useClock } from "./useClock";

const Group = ({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) => (
  <details open={open} className="rounded-xl border border-line px-3">
    <summary className="min-h-touch cursor-pointer py-3 font-semibold">{title}</summary>
    <div className="flex flex-col gap-3 pb-3">{children}</div>
  </details>
);

/** The demo control panel: scenarios, time, role, language, payment method, triggers, accessibility, and the decisions list. */
export function DemoPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { role, setRole } = useRole();
  const now = useClock();
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>(session.method);
  const langs: readonly Lang[] = role === "admin" || role === "support" ? config.adminLanguages : config.languages;
  const field = "min-h-touch rounded-lg border-2 border-ink bg-paper px-3 text-base font-normal";
  const trigger = (type: string) => { const r = runtime.dispatch(JOB_ID, { type }); setTriggerError(r.ok ? null : r.error ?? null); };

  return (
    <section aria-label={t("app.demoPanel")} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h2 className="text-lg font-bold">{t("app.demoPanel")}</h2>
      <A11yControl />

      <Group title={t("demo.scenarios")}><ScenarioRunner /></Group>

      <Group title={t("demo.controls")} open>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("roles.label")}
          <select className={field} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </select>
        </label>
        {role === "admin" && <p className="text-sm text-inkSoft">{t("roles.adminNote")}</p>}
        {role === "support" && <p className="text-sm text-inkSoft">{t("roles.supportNote")}</p>}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("lang.label")}
          <select className={field} value={lang} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
            {langs.map((l) => <option key={l} value={l}>{languageNames[l]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("demo.paymentDefault")}
          <select className={field} value={method} onChange={(e) => { const m = e.target.value as PayMethod; setMethod(m); session.method = m; }}>
            {(["card", "wallet", "cash", "spei"] as const).map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
          </select>
        </label>
        <p aria-live="polite">{t("clock.now", { time: formatDateTime(now, localeFor[lang]) })}</p>
        <div className="flex flex-wrap gap-2">
          {[1, 12, 24].map((h) => (
            <Button key={h} variant="secondary" className="text-sm" onClick={() => runtime.advanceHours(h)}>{t("clock.forward", { hours: h })}</Button>
          ))}
          <Button variant="secondary" className="text-sm" onClick={() => { runtime.reset(); void resetDemo(); }}>{t("btn.resetData")}</Button>
        </div>
      </Group>

      <Group title={t("demo.trigger.title")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="text-sm" onClick={() => trigger("PRO_CANCELS")}>{t("demo.trigger.proCancels")}</Button>
          <Button variant="secondary" className="text-sm" onClick={() => trigger("PRO_NO_SHOW")}>{t("demo.trigger.noShow")}</Button>
        </div>
        {triggerError && <p role="alert" className="text-sm font-bold">{triggerError}</p>}
      </Group>

      <Group title={t("demo.decisions")}><DecisionsPanel /></Group>
    </section>
  );
}
