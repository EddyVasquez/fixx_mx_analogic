import { config } from "../../core/config/fixx.config";

export type Intent = "emergency" | "needsAgent" | "hours" | "howItWorks" | "greeting" | "fallback";
const KEYWORDS: Record<Exclude<Intent, "fallback">, string[]> = {
  emergency: ["gas leak", "fire", "flood", "electrocut", "emergency", "911", "fuga de gas", "incendio", "inundaci", "emergencia", "descarga", "가스", "화재", "불이", "감전", "응급", "긴급", "침수"],
  needsAgent: ["refund", "reimburse", "charged", "payment", "case", "report", "reembolso", "devoluci", "cobro", "pago", "caso", "reporte", "환불", "결제", "청구", "신고"],
  hours: ["hours", "open", "schedule", "horario", "abierto", "운영", "시간"],
  howItWorks: ["how", "work", "price", "cómo", "como", "funciona", "precio", "어떻게", "가격"],
  greeting: ["hi", "hello", "hola", "buenas", "안녕"]
};

export interface AssistantReply {
  intent: Intent; key: string; params: Record<string, string>;
  /** Offer a hand-off to a FIXX Agent. */
  needsAgent: boolean; showEmergencyLine: boolean;
}

/**
 * Scripted FIXX Assistant. It explains and routes. It never decides refunds, cases or payments:
 * anything touching those goes to a human Agent.
 */
export function respond(text: string): AssistantReply {
  const s = text.toLowerCase();
  const has = (i: Exclude<Intent, "fallback">) => KEYWORDS[i].some((k) => s.includes(k));
  const reply = (intent: Intent, needsAgent: boolean, params: Record<string, string> = {}, emergency = false): AssistantReply =>
    ({ intent, key: `assistant.reply.${intent}`, params, needsAgent, showEmergencyLine: emergency });
  if (has("emergency")) return reply("emergency", true, {}, true);
  if (has("needsAgent")) return reply("needsAgent", true);
  if (has("hours")) return reply("hours", false, { start: config.businessHours.start, end: config.businessHours.end });
  if (has("howItWorks")) return reply("howItWorks", false);
  if (has("greeting")) return reply("greeting", false);
  return reply("fallback", false);
}
/** Always say who the person is talking to. */
export const handlerLabelKey = (h: "assistant" | "agent"): string => (h === "agent" ? "agent.label" : "assistant.label");
