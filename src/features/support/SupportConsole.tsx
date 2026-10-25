import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { useRuntime } from "@/demo/runtime";
import { agentJoins, agentSays, closeChat, supportState } from "@/mocks/runtime/supportActions";
import { macroLines } from "@/mocks/support/supportStore";
import { Button } from "@/ui/Button";
import { inputClass } from "@/ui/Field";
import { SupportLine } from "./SupportChatView";

/** FIXX Agent view. English and Spanish only: Korean customers are served through translation. */
export function SupportConsole({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const [text, setText] = useState("");
  const staffLang: "en" | "es" = lang === "es" ? "es" : "en";
  const state = supportState(rt);
  const msgs = rt.support.list();
  const emergency = !!(rt.get("support:main")?.snap.ctx as { isEmergency?: boolean } | undefined)?.isEmergency;
  const canJoin = state === "agentQueue" || state === "offline";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("admin.support.title")}</h2>
      {!state ? <p className="rounded-2xl border border-line bg-paper p-4">{t("admin.support.noChat")}</p> : (
        <>
          <p className="font-semibold">{t("admin.support.state")}: {t(`admin.support.s.${state}`)}</p>
          {emergency && <p role="alert" className="rounded-lg border-2 border-ink p-2 font-bold">{t("admin.support.emergency")}</p>}
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto" aria-live="polite">
            {msgs.map((m) => <SupportLine key={m.id} m={m} viewer={staffLang} mine={m.from === "agent"} />)}
          </ul>
          <div className="flex gap-2">
            {canJoin && <Button onClick={() => agentJoins(rt)}>{t("admin.support.join")}</Button>}
            {state === "agent" && <Button variant="secondary" onClick={() => closeChat(rt)}>{t("admin.support.close")}</Button>}
          </div>
          {state === "agent" && (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="font-semibold">{t("admin.support.macros")}</legend>
                {macroLines(staffLang).map((l) => (
                  <Button key={l} variant="secondary" className="h-auto py-2 text-left text-sm" onClick={() => setText(l)}>{l}</Button>
                ))}
              </fieldset>
              <div className="flex gap-2">
                <input className={inputClass} aria-label={t("admin.support.reply")} value={text} onChange={(e) => setText(e.target.value)} />
                <Button onClick={() => { if (agentSays(rt, text, staffLang)) setText(""); }}>{t("btn.send")}</Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
