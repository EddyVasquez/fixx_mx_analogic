import type { Lang } from "../../core/config/fixx.config";
import { PHRASEBOOK, translate } from "../translation/translator";

export interface SupportMsg {
  id: string; from: "user" | "assistant" | "agent"; at: string; lang: Lang;
  /** user and agent messages carry text and its translations; assistant messages carry a copy key. */
  text?: string; translations?: Partial<Record<Lang, string>>; replyKey?: string; params?: Record<string, string>;
}
const ALL: readonly Lang[] = ["en", "es", "ko"];

/** Support chat log. Every message says who wrote it: the person, the Assistant (automated) or an Agent (person). */
export class SupportStore {
  private msgs: SupportMsg[] = [];
  private seq = 1;
  private withText(from: "user" | "agent", text: string, lang: Lang, at: Date): SupportMsg {
    const translations: Partial<Record<Lang, string>> = {};
    for (const l of ALL) if (l !== lang) translations[l] = translate(text, lang, l).text;
    const m: SupportMsg = { id: `s-${this.seq++}`, from, at: at.toISOString(), lang, text, translations };
    this.msgs.push(m);
    return m;
  }
  user(text: string, lang: Lang, at: Date): SupportMsg { return this.withText("user", text, lang, at); }
  agent(text: string, lang: Lang, at: Date): SupportMsg { return this.withText("agent", text, lang, at); }
  assistant(replyKey: string, params: Record<string, string>, lang: Lang, at: Date): SupportMsg {
    const m: SupportMsg = { id: `s-${this.seq++}`, from: "assistant", at: at.toISOString(), lang, replyKey, params };
    this.msgs.push(m);
    return m;
  }
  list(): SupportMsg[] { return this.msgs.slice(); }
  clear(): void { this.msgs = []; }
}

/** What a viewer reads: their language when a translation exists, flagged so the UI can show "See original". */
export function supportView(m: SupportMsg, viewer: Lang): { text: string; translated: boolean; original: string } {
  const original = m.text ?? "";
  const t = viewer === m.lang ? undefined : m.translations?.[viewer];
  return { text: t ?? original, translated: t !== undefined, original };
}
/** Agent macros in the Agent's language (English or Spanish). */
export const macroLines = (lang: "en" | "es"): string[] => PHRASEBOOK.filter((e) => e.role === "agent").map((e) => e[lang]);
