import { supportMachine, activeHandler, type SupportState } from "../../core/machines/supportChat";
import type { Lang } from "../../core/config/fixx.config";
import { respond } from "../assistant/assistant";
import type { DemoRuntime } from "./runtime";

const ID = "support:main";
export const supportState = (rt: DemoRuntime): SupportState | undefined => rt.get(ID)?.snap.state as SupportState | undefined;

function ensure(rt: DemoRuntime, lang: Lang): void {
  if (!rt.get(ID)) rt.spawn(ID, "support", supportMachine, { language: lang, isEmergency: false });
}

/** A person writes. While the Assistant has the chat it answers; after an Agent joins, it stays quiet. */
export function userSays(rt: DemoRuntime, text: string, lang: Lang): void {
  if (!text.trim()) return;
  ensure(rt, lang);
  const now = rt.clock.now();
  rt.support.user(text.trim(), lang, now);
  if (activeHandler(supportState(rt)!) === "assistant") {
    const r = respond(text);
    rt.support.assistant(r.key, r.params, lang, now);
    if (r.showEmergencyLine) (rt.get(ID)!.snap.ctx as { isEmergency: boolean }).isEmergency = true;
  }
  rt.touch();
}

/** Hand-off to a person. In Agent hours the chat queues; outside them the Assistant keeps helping and an Agent follows up next support day. */
export function requestAgent(rt: DemoRuntime, lang: Lang): void {
  ensure(rt, lang);
  const res = rt.dispatch(ID, { type: "REQUEST_AGENT" });
  if (!res.ok) return;
  rt.support.assistant(supportState(rt) === "agentQueue" ? "assistant.reply.handoffQueued" : "assistant.reply.handoffOffline", {}, lang, rt.clock.now());
  rt.touch();
}
export const agentJoins = (rt: DemoRuntime) => rt.dispatch(ID, { type: "AGENT_JOINS" });
export function agentSays(rt: DemoRuntime, text: string, lang: "en" | "es"): boolean {
  if (supportState(rt) !== "agent" || !text.trim()) return false;
  rt.support.agent(text.trim(), lang, rt.clock.now());
  rt.touch();
  return true;
}
export function closeChat(rt: DemoRuntime): void {
  rt.dispatch(ID, { type: supportState(rt) === "agent" ? "CLOSE" : "RESOLVED" });
}
/** Start over with a fresh conversation. */
export function newChat(rt: DemoRuntime): void {
  rt.dropPrefix("support:");
  rt.support.clear();
  rt.touch();
}
