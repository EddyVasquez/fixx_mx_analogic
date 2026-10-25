import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { useRuntime } from "@/demo/runtime";
import { agentJoins, newChat, requestAgent, supportState, userSays } from "@/mocks/runtime/supportActions";
import { supportView, type SupportMsg } from "@/mocks/support/supportStore";
import { Button } from "@/ui/Button";
import { inputClass } from "@/ui/Field";

export const fromLabelKey = (from: SupportMsg["from"]): string => (from === "user" ? "support.you" : from === "assistant" ? "assistant.label" : "agent.label");

/** One chat line, always labelled with who wrote it. Translated lines say so and keep the original. */
export function SupportLine({ m, viewer, mine }: { m: SupportMsg; viewer: Lang; mine: boolean }) {
  const { t } = useTranslation();
  const [original, setOriginal] = useState(false);
  const v = supportView(m, viewer);
  const body = m.replyKey ? t(m.replyKey, m.params) : original ? v.original : v.text;
  return (
    <li className={`max-w-[88%] rounded-2xl p-3 ${mine ? "self-end bg-panel" : "self-start border border-line bg-paper"}`}>
      <p className="text-sm font-bold">{t(fromLabelKey(m.from))}</p>
      <p>{body}</p>
      {v.translated && !m.replyKey && (
        <p className="text-sm text-inkSoft">
          {t("translation.auto")}{" "}
          <button type="button" className="min-h-touch font-semibold underline" onClick={() => setOriginal(!original)}>
            {original ? t("btn.hideOriginal") : t("btn.seeOriginal")}
          </button>
        </p>
      )}
    </li>
  );
}

/** Help chat for customers and professionals: the Assistant first, then a hand-off to a FIXX Agent. */
export function SupportChatView({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const rt = useRuntime();
  const [text, setText] = useState("");
  const state = supportState(rt);
  const msgs = rt.support.list();
  const send = () => { userSays(rt, text, lang); setText(""); };

  return (
    <section aria-labelledby="support-title" className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h2 id="support-title" className="text-lg font-bold">{t("support.title")}</h2>
      <p className="text-sm font-semibold">{state === "agent" ? t("agent.label") : t("assistant.label")}</p>
      {lang === "ko" && <p className="text-sm text-inkSoft">{t("support.koreanNote")}</p>}
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {msgs.length === 0 && <li className="text-inkSoft">{t("assistant.reply.greeting")}</li>}
        {msgs.map((m) => <SupportLine key={m.id} m={m} viewer={lang} mine={m.from === "user"} />)}
      </ul>
      {state === "agentQueue" && <p role="status" className="font-semibold">{t("support.queued")}</p>}
      {state === "offline" && <p role="status" className="font-semibold">{t("support.offlineNote")}</p>}
      {state === "agent" && <p role="status" className="font-semibold">{t("support.agentHere")}</p>}
      {state === "closed" ? (
        <>
          <p>{t("support.closed")}</p>
          <Button onClick={() => newChat(rt)}>{t("btn.newChat")}</Button>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input className={inputClass} aria-label={t("chat.placeholder")} placeholder={t("chat.placeholder")} value={text}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            <Button onClick={send}>{t("btn.send")}</Button>
          </div>
          {(state === undefined || state === "assistant") && <Button variant="secondary" onClick={() => requestAgent(rt, lang)}>{t("btn.talkToAgent")}</Button>}
        </>
      )}
      {/* Demo only: the Agent joins from the Support console in a real setup. */}
      {(state === "agentQueue" || state === "offline") && (
        <div className="rounded-2xl border-2 border-dashed border-ink p-3">
          <Button variant="secondary" onClick={() => agentJoins(rt)}>{t("demo.agent.title")}</Button>
        </div>
      )}
    </section>
  );
}
