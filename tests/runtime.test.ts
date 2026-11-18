import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Clock } from "../src/core/clock/clock";
import { Scheduler } from "../src/core/clock/scheduler";
import { config } from "../src/core/config/fixx.config";
import { addHours } from "../src/core/rules";
import { jobMachine, newJobCtx, type JobCtx } from "../src/core/machines";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { notificationText, type NotificationRecord } from "../src/mocks/notifications/center";
import { cashReference, speiDetails, chargeCard, chargeWallet, DEMO_CARDS } from "../src/mocks/payments/gateway";
import { translate, makeMessage, viewFor, officialLanguage } from "../src/mocks/translation/translator";
import { respond } from "../src/mocks/assistant/assistant";

const t0 = new Date("2026-10-06T16:00:00Z");
const at = (h: number) => addHours(t0, h);
const LINES = [{ id: "prep", amount: 600 }, { id: "mat", amount: 1400 }, { id: "paint", amount: 2200 }];

function setup() {
  const rt = new DemoRuntime(new Clock(0, () => t0.getTime()));
  rt.spawn("job", "job", jobMachine, newJobCtx({ professionalId: "p2" }), { categoryId: "painting" });
  return rt;
}
function d(rt: DemoRuntime, ...events: object[]) {
  for (const e of events) {
    const r = rt.dispatch("job", e as { type: string });
    if (!r.ok) throw new Error(`${(e as { type: string }).type}: ${r.error}`);
  }
}
const toQuote = (rt: DemoRuntime) => d(rt, { type: "ESTIMATE_READY" }, { type: "RECOMMENDATIONS_READY" }, { type: "SELECT_PROFESSIONAL", professionalId: "p2" },
  { type: "SEND_QUOTE", total: 4200, travelFee: 150, payoutRatio: 0.8, lines: LINES });
const accept = (rt: DemoRuntime, method: "card" | "cash", hours: number) => d(rt, { type: "ACCEPT_QUOTE", method, jobStart: addHours(rt.clock.now(), hours) });
const state = (rt: DemoRuntime, id = "job") => rt.get(id)?.snap.state;
const ctx = (rt: DemoRuntime) => rt.get("job")?.snap.ctx as JobCtx;

describe("scheduler", () => {
  it("fires in time order and ignores duplicates", () => {
    const s = new Scheduler();
    expect(s.add("a", at(5), { type: "X" }, "x")).toBe(true);
    expect(s.add("a", at(5), { type: "X" }, "x")).toBe(false);
    s.add("a", at(2), { type: "Y" }, "y");
    expect(s.takeNextDue(at(1))).toBeNull();
    expect(s.takeNextDue(at(10))?.event.type).toBe("Y");
    expect(s.takeNextDue(at(10))?.event.type).toBe("X");
    expect(s.takeNextDue(at(10))).toBeNull();
  });
});

describe("runtime: deadlines fire when the clock jumps", () => {
  it("cash, unpaid deposit: the booking expires and the customer is told on push, WhatsApp and in-app", () => {
    const rt = setup(); toQuote(rt); accept(rt, "cash", 72);
    rt.advanceHours(23); expect(state(rt)).toBe("awaitingDeposit");
    rt.advanceHours(2); expect(state(rt)).toBe("bookingExpired");
    const ch = new Set(rt.center.list().filter((r) => r.template === "booking.expired" && r.audience === "customer").map((r) => r.channel));
    expect(ch).toEqual(new Set(["push", "whatsapp", "inApp"]));
  });
  it("cash, deposit paid but balance late: the job is cancelled and the deposit goes back to a CLABE", () => {
    const rt = setup(); toQuote(rt); accept(rt, "cash", 72);
    d(rt, { type: "PAYMENT_SATISFIED", amount: 840 });
    rt.advanceHours(49);
    expect(state(rt)).toBe("cancelled");
    expect(rt.refunds).toHaveLength(1);
    expect(rt.refunds[0]).toMatchObject({ amount: 840, destination: "clabe" });
  });
  it("a reschedule moves the balance deadline", () => {
    const rt = setup(); toQuote(rt); accept(rt, "cash", 72);
    d(rt, { type: "PAYMENT_SATISFIED", amount: 840 });
    d(rt, { type: "RESCHEDULE_ACCEPTED", newStart: at(120) });
    const times = rt.scheduler.list("job").filter((x) => x.event.type === "BALANCE_OVERDUE").map((x) => x.at.getTime());
    expect(times).toEqual([at(96).getTime()]);
  });
  it("card job: runs to payment released, then the warranty starts and later ends", () => {
    const rt = setup(); toQuote(rt); accept(rt, "card", 72);
    d(rt, { type: "PAYMENT_SATISFIED", amount: 840 });
    rt.advanceHours(72);
    d(rt, { type: "ON_THE_WAY" }, { type: "CHECK_IN" }, { type: "START_WORK" }, { type: "CHECKLIST_COMPLETE" }, { type: "MARK_COMPLETE" }, { type: "BALANCE_PAID" });
    const firstReminder = config.completionCheck.reminders[0]!.hours;
    rt.advanceHours(firstReminder);
    expect(rt.center.list().some((r) => r.template === "issueWindow.reminder" && r.audience === "customer")).toBe(true);
    rt.advanceHours(config.completionCheck.autoReleaseHours - firstReminder);
    expect(state(rt)).toBe("paymentReleased");
    expect(rt.payouts[0]?.amount).toBe(3360);
    expect(state(rt, "warranty:job")).toBe("running");
    rt.advanceHours(24 * 31);
    expect(state(rt, "warranty:job")).toBe("expired");
  });
  it("an issue report opens a case with the held amount; a no-show records a penalty", () => {
    const rt = setup(); toQuote(rt); accept(rt, "card", 1);
    d(rt, { type: "PAYMENT_SATISFIED", amount: 840 }, { type: "ON_THE_WAY" }, { type: "CHECK_IN" }, { type: "START_WORK" },
      { type: "CHECKLIST_COMPLETE" }, { type: "MARK_COMPLETE" }, { type: "BALANCE_PAID" }, { type: "REPORT_ISSUE", selected: "wholeJob" });
    expect(state(rt, "case:job")).toBe("reported");
    expect((rt.get("case:job")?.snap.ctx as { heldAmount: number }).heldAmount).toBe(4200);
    const rt2 = setup(); toQuote(rt2); accept(rt2, "card", 1);
    d(rt2, { type: "PAYMENT_SATISFIED", amount: 840 }, { type: "PRO_NO_SHOW" });
    expect(rt2.penalties[0]?.reason).toBe("noShow");
    d(rt2, { type: "CHOOSE_REFUND" });
    expect(rt2.refunds[0]).toMatchObject({ amount: 840, destination: "original" });
  });
});

describe("notification center", () => {
  it("delivers in each recipient's language", () => {
    const rt = setup(); rt.languages.customer = "ko"; rt.languages.professional = "es";
    toQuote(rt); accept(rt, "card", 72);
    const recs = rt.center.list().filter((r) => r.template === "quote.accepted");
    expect(new Set(recs.filter((r) => r.audience === "customer").map((r) => r.language))).toEqual(new Set(["ko"]));
    expect(new Set(recs.filter((r) => r.audience === "professional").map((r) => r.language))).toEqual(new Set(["es"]));
  });
  it("Admin and Support only get in-app and email", () => {
    const rt = setup(); d(rt, { type: "OUT_OF_AREA" });
    const admin = rt.center.list({ audience: "admin" });
    expect(admin.length).toBeGreaterThan(0);
    admin.forEach((r) => expect(r.channel === "inApp" || r.channel === "email").toBe(true));
  });
  it("picks audience-specific copy first, then outcome copy, then the shared copy", () => {
    const rec = (template: string, audience: NotificationRecord["audience"], params: NotificationRecord["params"] = {}): NotificationRecord =>
      ({ id: "n", at: t0.toISOString(), channel: "push", audience, language: "ko", template, params, actorId: "job" });
    const en = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/en/notifications.json"), "utf8")) as Record<string, unknown>;
    let lng = "", moneyCalls = 0;
    const t = (keys: string | string[], o?: Record<string, unknown>) => { lng = String(o?.["lng"]); return [keys].flat().find((k) => k in en) ?? "MISSING"; };
    const money = (n: number) => { moneyCalls++; return String(n); };
    expect(notificationText(rec("job.noShow", "professional"), t, money)).toBe("notif.job.noShow.professional");
    expect(notificationText(rec("job.noShow", "admin"), t, money)).toBe("notif.job.noShow");
    expect(notificationText(rec("warranty.claimDecided", "customer", { outcome: "resolved" }), t, money)).toBe("notif.warranty.claimDecided.resolved");
    expect(lng).toBe("ko");
    notificationText(rec("job.cancelledByCustomer", "customer", { travelFee: 150, refund: 690 }), t, money);
    expect(moneyCalls).toBe(2);
  });
});

describe("copy coverage and privacy", () => {
  const read = (lang: string) => JSON.parse(readFileSync(join(process.cwd(), `src/i18n/${lang}/notifications.json`), "utf8")) as Record<string, { text: string }>;
  const dir = join(process.cwd(), "src/core/machines");
  const templates = new Set<string>(["case.final", "case.reviewDecided"]);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/notify\(\s*"([^"]+)"/g)) templates.add(m[1] as string);
  }
  it("every notification template has copy in EN, ES and KO", () => {
    expect(templates.size).toBeGreaterThan(50);
    for (const lang of ["en", "es", "ko"]) {
      const keys = Object.keys(read(lang));
      for (const tpl of templates) {
        expect(keys.some((k) => k === `notif.${tpl}` || k.startsWith(`notif.${tpl}.`))).toBe(true);
      }
    }
  });
  it("professional copy never shows customer totals, held amounts or refunds", () => {
    for (const lang of ["en", "es", "ko"]) {
      for (const [k, v] of Object.entries(read(lang))) {
        if (k.endsWith(".professional")) ["{held}", "{refund}", "{amount}"].forEach((p) => expect(v.text.includes(p)).toBe(false));
      }
    }
  });
  it("assistant replies exist for every intent", () => {
    for (const lang of ["en", "es", "ko"]) {
      const keys = Object.keys(read(lang));
      ["greeting", "howItWorks", "hours", "needsAgent", "emergency", "fallback"].forEach((i) => expect(keys.includes(`assistant.reply.${i}`)).toBe(true));
    }
  });
});

describe("payment mocks", () => {
  it("references are deterministic and clearly fake", () => {
    expect(cashReference("p1")).toBe(cashReference("p1"));
    expect(cashReference("p1").startsWith("DEMO-")).toBe(true);
    expect(cashReference("p1") === cashReference("p2")).toBe(false);
    const s = speiDetails("p1");
    expect(/^\d{18}$/.test(s.clabe)).toBe(true);
    expect(s.clabe.startsWith("000")).toBe(true);
  });
  it("cards: approved, declined and invalid test numbers; wallets succeed", () => {
    expect(chargeCard(DEMO_CARDS.approved, 840)).toEqual({ ok: true });
    expect(chargeCard(DEMO_CARDS.declined, 840)).toEqual({ ok: false, reason: "declined" });
    expect(chargeCard("1234", 840)).toEqual({ ok: false, reason: "invalid" });
    expect(chargeWallet(840)).toEqual({ ok: true });
  });
});

describe("translation mock (scenario 12)", () => {
  it("translates scripted Korean to Spanish and back, flagged as automatic", () => {
    const ko = "안녕하세요, 내일 오전 10시에 가능할까요?";
    const es = translate(ko, "ko", "es");
    expect(es).toMatchObject({ text: "Hola, ¿es posible mañana a las 10 de la mañana?", auto: true, matched: true });
    expect(translate(es.text, "es", "ko").text).toBe(ko);
  });
  it("unknown text gets an obvious demo prefix; same language is untouched", () => {
    expect(translate("hola", "es", "ko").text.startsWith("[demo es→ko]")).toBe(true);
    expect(translate("hola", "es", "es")).toMatchObject({ text: "hola", auto: false });
  });
  it("messages keep the original and show the viewer's language", () => {
    const m = makeMessage({ id: "m1", jobId: "job", authorRole: "customer", language: "ko", text: "사진 보냈어요. 감사합니다.", at: t0 });
    const pro = viewFor(m, "es");
    expect(pro).toMatchObject({ text: "Ya envié la foto. Gracias.", translated: true, originalLanguage: "ko" });
    expect(viewFor(m, "ko")).toMatchObject({ translated: false, text: "사진 보냈어요. 감사합니다." });
    expect(officialLanguage("ko")).toBe("ko");
  });
});

describe("scripted Assistant", () => {
  it("hands refunds, cases and payments to an Agent", () => {
    expect(respond("I want a refund")).toMatchObject({ intent: "needsAgent", needsAgent: true });
    expect(respond("quiero un reembolso")).toMatchObject({ needsAgent: true });
    expect(respond("환불하고 싶어요")).toMatchObject({ needsAgent: true });
  });
  it("shows the 911 line for emergencies", () => {
    expect(respond("there is a gas leak")).toMatchObject({ intent: "emergency", showEmergencyLine: true, needsAgent: true });
    expect(respond("fuga de gas")).toMatchObject({ showEmergencyLine: true });
  });
  it("answers hours, how it works, greetings and falls back politely", () => {
    expect(respond("what are your hours?")).toMatchObject({ intent: "hours", params: { start: "09:00", end: "18:00" } });
    expect(respond("how does it work")).toMatchObject({ intent: "howItWorks" });
    expect(respond("hola")).toMatchObject({ intent: "greeting" });
    expect(respond("zzz")).toMatchObject({ intent: "fallback", needsAgent: false });
  });
});
