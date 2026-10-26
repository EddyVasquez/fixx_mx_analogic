import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { ErrorText } from "@/ui/Field";
import { runtime } from "./runtime";
import { useRole } from "./roles";
import { SCENARIOS, finishScenario, startScenario } from "./scenarios";
import { scenarioNoticeText, type ScenarioNotice } from "./scenarioNotice";

/** Jump into any scenario: it runs up to a meaningful point, switches role and language, and hands over. Or finish it for you. */
export function ScenarioRunner() {
  const { t, i18n } = useTranslation();
  const { setRole } = useRole();
  const [id, setId] = useState(SCENARIOS[0]?.id ?? "");
  const [notice, setNotice] = useState<ScenarioNotice | null>(null);
  const [error, setError] = useState<ScenarioNotice | null>(null);

  const start = () => {
    try {
      const r = startScenario(runtime, id, i18n.language as Lang);
      setRole(r.role);
      void i18n.changeLanguage(r.language);
      setNotice({ kind: "handoff", role: r.role });
      setError(null);
    } catch (e) { setError({ kind: "raw", text: e instanceof Error ? e.message : String(e) }); }
  };
  const finish = () => {
    try { finishScenario(runtime, id); setNotice({ kind: "finished" }); setError(null); }
    catch (e) { setError(e instanceof Error && e.message.startsWith("start") ? { kind: "notStarted" } : { kind: "raw", text: e instanceof Error ? e.message : String(e) }); }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("scenario.label")}
        <select className="min-h-touch rounded-lg border-2 border-ink bg-paper px-3 text-base font-normal" value={id} onChange={(e) => { setId(e.target.value); setNotice(null); setError(null); }}>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{t(`scenario.${s.id}.title`)}</option>)}
        </select>
      </label>
      <p className="text-sm text-inkSoft">{t(`scenario.${id}.try`)}</p>
      <div className="flex flex-wrap gap-2">
        <Button className="text-sm" onClick={start}>{t("btn.startScenario")}</Button>
        <Button variant="secondary" className="text-sm" onClick={finish}>{t("btn.finishForMe")}</Button>
      </div>
      {notice && <p role="status" className="font-semibold">{scenarioNoticeText(notice, t)}</p>}
      {error && <ErrorText>{scenarioNoticeText(error, t)}</ErrorText>}
    </div>
  );
}
