import type { Lang } from "../../core/config/fixx.config";
import { makeMessage, PHRASEBOOK, type Message } from "../translation/translator";

/** In-app chat between customer and professional. Every message is translated for all languages when it is sent. */
export class ChatStore {
  private msgs: Message[] = [];
  private seq = 1;
  send(jobId: string, role: Message["authorRole"], language: Lang, text: string, at: Date): Message {
    const m = makeMessage({ id: `m-${this.seq++}`, jobId, authorRole: role, language, text, at });
    this.msgs.push(m);
    return m;
  }
  list(jobId: string): Message[] { return this.msgs.filter((m) => m.jobId === jobId); }
  clear(): void { this.msgs = []; }
}

/** Scripted lines for the Korean customer / Spanish professional demo, in the sender's language. */
export const demoLines = (role: Message["authorRole"], lang: Lang): string[] => PHRASEBOOK.filter((e) => e.role === role).map((e) => e[lang]);
