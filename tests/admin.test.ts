import { describe, it, expect } from "vitest";
import { Clock } from "../src/core/clock/clock";
import { addHours } from "../src/core/rules";
import { jobMachine, newJobCtx } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { userSays, requestAgent, agentJoins, agentSays, closeChat, newChat, supportState } from "../src/mocks/runtime/supportActions";
import { supportView, macroLines } from "../src/mocks/support/supportStore";
import { demoLines } from "../src/mocks/chat/chatStore";

const inHours = new Date("2026-10-06T16:00:00Z");   // Tuesday 10:00 in Monterrey
const afterHours = new Date("2026-10-07T03:00:00Z"); // Tuesday 21:00 in Monterrey
const mk = (at: Date) => new DemoRuntime(new Clock(0, () => at.getTime()));
const kinds = (rt: DemoRuntime) => rt.support.list().map((m) => m.from + (m.replyKey ? ":" + m.replyKey : ""));

describe("support chat: Assistant, hand-off, Agent", () => {
  it("the Assistant answers, and sends refunds to an Agent", () => {
    const rt = mk(inHours);
    userSays(rt, "hola", "es");
    userSays(rt, "I want a refund", "en");
    expect(kinds(rt)).toEqual(["user", "assistant:assistant.reply.greeting", "user", "assistant:assistant.reply.needsAgent"]);
  });
  it("emergencies get the 911 line", () => {
    const rt = mk(inHours);
    userSays(rt, "there is a gas leak", "en");
    expect(kinds(rt)).toContain("assistant:assistant.reply.emergency");
  });
  it("in Agent hours the chat queues; the Agent joins and the Assistant goes quiet", () => {
    const rt = mk(inHours);
    userSays(rt, "I need help with a charge", "en");
    requestAgent(rt, "en");
    expect(supportState(rt)).toBe("agentQueue");
    expect(kinds(rt)).toContain("assistant:assistant.reply.handoffQueued");
    agentJoins(rt);
    expect(supportState(rt)).toBe("agent");
    const before = rt.support.list().length;
    userSays(rt, "thank you", "en");
    expect(rt.support.list().length).toBe(before + 1); // only the user's line
    expect(agentSays(rt, macroLines("en")[0]!, "en")).toBe(true);
    closeChat(rt);
    expect(supportState(rt)).toBe("closed");
  });
  it("outside Agent hours the Assistant keeps helping and an Agent follows up next support day", () => {
    const rt = mk(afterHours);
    userSays(rt, "hello", "en");
    requestAgent(rt, "en");
    expect(supportState(rt)).toBe("offline");
    expect(kinds(rt)).toContain("assistant:assistant.reply.handoffOffline");
    userSays(rt, "how does it work", "en");
    expect(kinds(rt)[kinds(rt).length - 1]).toBe("assistant:assistant.reply.howItWorks");
    expect(agentSays(rt, "hi", "en")).toBe(false); // no Agent yet
  });
  it("Korean users read Agent macros in Korean; Agents read the user's line in their language", () => {
    const rt = mk(inHours);
    userSays(rt, demoLines("customer", "ko")[1]!, "ko"); // scripted line
    requestAgent(rt, "ko"); agentJoins(rt);
    agentSays(rt, macroLines("es")[2]!, "es");
    const [u, , , a] = rt.support.list();
    expect(supportView(a!, "ko")).toMatchObject({ translated: true, text: "문제를 보여주는 사진과 간단한 설명을 보내 주시겠어요?" });
    expect(supportView(a!, "es")).toMatchObject({ translated: false });
    expect(supportView(u!, "es")).toMatchObject({ translated: true, text: "Ya envié la foto. Gracias." });
  });
  it("starts a fresh chat", () => {
    const rt = mk(inHours);
    userSays(rt, "hi", "en"); newChat(rt);
    expect(rt.support.list()).toHaveLength(0);
    expect(supportState(rt)).toBe(undefined);
  });
});

describe("Admin actions", () => {
  it("internal notes need text; Quality Score changes need a non-zero amount and a reason", () => {
    const rt = mk(inHours);
    expect(rt.addNote("job", "  ")).toBe(false);
    expect(rt.addNote("job", "Called the customer")).toBe(true);
    expect(rt.notes).toHaveLength(1);
    expect(rt.recordScoreChange("p6", 0, "x")).toBe(false);
    expect(rt.recordScoreChange("p6", -2, "")).toBe(false);
    expect(rt.recordScoreChange("p6", -2, "Late arrival")).toBe(true);
    rt.reset();
    expect(rt.notes).toHaveLength(0);
    expect(rt.scoreChanges).toHaveLength(0);
  });
  it("lists actors by kind", () => {
    const rt = mk(inHours);
    rt.spawn("job", "job", jobMachine, newJobCtx());
    expect(rt.list("job")).toHaveLength(1);
    expect(rt.list("case")).toHaveLength(0);
  });
  it("the held amount can be set before a decision, within the job total, and recalculates the net share", () => {
    const rt = mk(inHours);
    rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p6" }), { categoryId: "painting" });
    const go = (e: object) => { const r = rt.dispatch("job", e as { type: string }); if (!r.ok) throw new Error(r.error); };
    const lines = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "work", amount: 2200 }];
    for (const e of [{ type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }, { type: "SELECT_PROFESSIONAL", professionalId: "p6" },
      { type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines },
      { type: "ACCEPT_QUOTE", method: "card", jobStart: addHours(inHours, 30) }, { type: "PAYMENT_SATISFIED", amount: 840 }]) go(e);
    rt.advanceHours(30);
    for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK", "CHECKLIST_COMPLETE", "MARK_COMPLETE", "BALANCE_PAID"]) go({ type: e });
    go({ type: "REPORT_ISSUE", selected: ["mat"] });
    expect(rt.setCaseHeld("job", 0)).toBe(false);
    expect(rt.setCaseHeld("job", 5000)).toBe(false);
    expect(rt.setCaseHeld("job", 1000)).toBe(true);
    expect(rt.get("case:job")!.snap.ctx).toMatchObject({ heldAmount: 1000, heldPayout: 800 });
    rt.dispatch("case:job", { type: "START_REVIEW" });
    rt.dispatch("case:job", { type: "DECIDE", decision: "split" });
    expect(rt.setCaseHeld("job", 900)).toBe(false); // too late once decided
  });
});
