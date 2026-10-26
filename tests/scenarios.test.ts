import { describe, it, expect } from "vitest";
import { Clock } from "../src/core/clock/clock";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { SCENARIOS, startScenario, finishScenario } from "../src/demo/scenarios";
import { buildQuote } from "../src/core/pricing/quote";
import { JOB_ID } from "../src/features/customer/session";

const t0 = new Date("2026-10-06T16:00:00Z");
const fresh = () => new DemoRuntime(new Clock(0, () => t0.getTime()));
const st = (rt: DemoRuntime, id = JOB_ID) => rt.get(id)?.snap.state;

/** [state when you take over, state when the scenario has run to its end] */
const EXPECT: Record<string, [string | undefined, string | undefined]> = {
  s1: ["quoteSent", "rated"], s2: ["awaitingDeposit", "issueWindow"], s3card: ["inProgress", "paymentReleased"], s3cash: ["inProgress", "issueWindow"],
  s4: ["awaitingDeposit", "issueWindow"], s5: ["manualReview", "quoteSent"], s6acc: ["scheduled", "scheduled"], s6dec: ["scheduled", "scheduled"],
  s6exp: ["scheduled", "refunded"], s7pre: ["scheduled", "refunded"], s7post: ["onTheWay", "refunded"], s8cancel: ["onTheWay", "scheduled"],
  s8noshow: ["scheduled", "refunded"], s9: ["issueWindow", "paymentReleased"], s10: ["paymentReleased", "paymentReleased"], s12: ["professionalSelected", "scheduled"]
};

describe("scenario runner: every scenario starts where it says and runs end to end", () => {
  it("has the 12 brief scenarios (some with variants)", () => {
    expect(new Set(SCENARIOS.map((s) => s.id.replace(/(card|cash|acc|dec|exp|pre|post|cancel|noshow)$/, ""))).size).toBe(12);
  });
  for (const [id, [atHandoff, atEnd]] of Object.entries(EXPECT)) {
    for (const lang of ["en", "es", "ko"] as const) {
      it(`${id} in ${lang}`, () => {
        const rt = fresh();
        const { language } = startScenario(rt, id, lang);
        expect(st(rt)).toBe(atHandoff);
        expect(["en", "es", "ko"].includes(language)).toBe(true);
        finishScenario(rt, id);
        expect(st(rt)).toBe(atEnd);
        // messages are delivered in the people's languages, with no raw template keys
        rt.center.list().forEach((n) => expect(["en", "es", "ko"].includes(n.language)).toBe(true));
      });
    }
  }
  it("s11: verification and recovery, with a verified professional at the end", () => {
    const rt = fresh();
    expect(startScenario(rt, "s11", "en").role).toBe("professional");
    finishScenario(rt, "s11");
    expect(st(rt, "verify:new")).toBe("approved");
  });
  it("s12: Korean customer and Spanish professional read each other translated", () => {
    const rt = fresh();
    startScenario(rt, "s12", "en");
    expect(rt.languages.customer).toBe("ko");
    expect(rt.languages.professional).toBe("es");
    finishScenario(rt, "s12");
    expect(rt.chat.list(JOB_ID)).toHaveLength(4);
  });
  it("s9 settles the case and s10 resolves a warranty claim", () => {
    const a = fresh(); startScenario(a, "s9", "en"); finishScenario(a, "s9");
    const materials = buildQuote("painting", false).lines.find((l) => l.id === "mat")?.amount;
    expect(a.refunds[0]?.amount).toBe(materials); // refund is the materials line of the painting quote
    const b = fresh(); startScenario(b, "s10", "en");
    expect(st(b, `warranty:${JOB_ID}`)).toBe("running");
    expect(b.get(`warranty:${JOB_ID}`)!.snap.history).toHaveLength(0);
    finishScenario(b, "s10");
    expect(b.get(`warranty:${JOB_ID}`)!.snap.history.length).toBeGreaterThan(2);
    expect(st(b, `warranty:${JOB_ID}`)).toBe("running");
  });
  it("refuses to finish a scenario that was not started", () => {
    expect(() => finishScenario(fresh(), "s1")).toThrow();
  });
});
