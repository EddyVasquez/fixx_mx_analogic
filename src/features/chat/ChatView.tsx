import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { demoLines } from "@/mocks/chat/chatStore";
import { viewFor } from "@/mocks/translation/translator";
import { useRuntime } from "@/demo/runtime";
import { Button } from "@/ui/Button";
import { inputClass } from "@/ui/Field";

/** In-app chat. You write in your language, the other person reads theirs; translated lines are labelled and keep the original. */
export function ChatView({ jobId, role }: { jobId: string; role: "customer" | "professional" }) {
  const { t, i18n } = useTranslation();
  const rt = useRuntime();
  const lang = i18n.language as Lang;
  const [text, setText] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const msgs = rt.chat.list(jobId);
  const send = (txt: string) => { if (txt.trim()) { rt.sendChat(jobId, role, lang, txt.trim()); setText(""); } };

  return (
    <section aria-labelledby={`chat-${role}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      <h2 id={`chat-${role}`} className="text-lg font-bold">{t("chat.title")}</h2>
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {msgs.length === 0 && <li className="text-inkSoft">{t("chat.empty")}</li>}
        {msgs.map((m) => {
          const v = viewFor(m, lang);
          const mine = m.authorRole === role;
          return (
            <li key={m.id} className={`max-w-[85%] rounded-2xl p-3 ${mine ? "self-end bg-panel" : "self-start border border-line"}`}>
              <p>{open[m.id] ? v.original : v.text}</p>
              {v.translated && (
                <p className="text-sm text-inkSoft">
                  {t("translation.auto")}{" "}
                  <button type="button" className="min-h-touch font-semibold underline" onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>
                    {open[m.id] ? t("btn.hideOriginal") : t("btn.seeOriginal")}
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t("chat.demoLines")}</p>
        {demoLines(role, lang).map((l) => (
          <Button key={l} variant="secondary" className="h-auto py-2 text-left text-sm" onClick={() => send(l)}>{l}</Button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputClass} aria-label={t("chat.placeholder")} placeholder={t("chat.placeholder")} value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(text); }} />
        <Button onClick={() => send(text)}>{t("btn.send")}</Button>
      </div>
    </section>
  );
}
