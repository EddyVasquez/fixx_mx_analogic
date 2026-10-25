import { isAgentHours } from "../rules";
import { notify, type Effect, type MachineDef, type Outcome } from "./machine";

export type SupportState = "assistant" | "agentQueue" | "agent" | "offline" | "closed";
export type SupportEvent = { type: "REQUEST_AGENT" } | { type: "AGENT_JOINS" } | { type: "RESOLVED" } | { type: "CLOSE" };
export interface SupportCtx { language: "en" | "es" | "ko"; isEmergency: boolean }

const go = (t: SupportState, fx: Effect[]): Outcome<SupportState, SupportCtx> => ({ target: t, effects: fx });
const joins = () => go("agent", [notify("support.agentJoined", ["customer"])]);

/** Always label who the person is talking to. The Assistant never decides refunds, cases or payments. */
export const activeHandler = (s: SupportState): "assistant" | "agent" | "none" =>
  s === "agent" ? "agent" : s === "closed" ? "none" : "assistant";

export const supportMachine: MachineDef<SupportState, SupportEvent, SupportCtx> = {
  id: "support", initial: "assistant",
  on: {
    assistant: {
      REQUEST_AGENT: (_c, _e, now) => isAgentHours(now)
        ? go("agentQueue", [notify("support.agentRequested", ["support"], "urgent")])
        : go("offline", [notify("support.offlineFollowUp", ["customer", "support"], "record")]),
      RESOLVED: () => go("closed", [notify("support.closed", ["customer"], "record")])
    },
    agentQueue: { AGENT_JOINS: joins },
    offline: { AGENT_JOINS: joins }, // human follow-up on the next support day
    agent: { CLOSE: () => go("closed", [notify("support.closed", ["customer"], "record")]) }
  }
};
