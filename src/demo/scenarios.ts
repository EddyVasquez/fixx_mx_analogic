import { config, type Lang } from "../core/config/fixx.config";
import { addHours, buildSchedule, type PayMethod } from "../core/rules";
import { buildQuote, humanReviewForCategory } from "../core/pricing/quote";
import { jobMachine, newJobCtx, verificationMachine, newVerification, type JobCtx } from "../core/machines";
import type { DemoRuntime } from "../mocks/runtime/runtime";
import { ensureReference, confirmPayment } from "../mocks/runtime/paymentActors";
import { requestReschedule, acceptReschedule, declineReschedule } from "../mocks/runtime/rescheduleActors";
import { demoLines } from "../mocks/chat/chatStore";
import { JOB_ID, resetSession, session } from "../features/customer/session";
import { psession } from "../features/professional/session";
import { photoQueue } from "../features/shared/photoQueue";

export type RoleName = "customer" | "professional";
export interface Scenario {
  id: string; role: RoleName; customerLang: Lang | "app"; proLang: Lang | "app";
  /** The customer tab to show when the scenario hands over. */
  tab?: "request" | "warranty";
  steps: Step[]; handoffAt: number;
}
type Step = (c: Ctx) => void;
interface Ctx { rt: DemoRuntime; job: (type: string, extra?: object) => void; ctx: () => JobCtx; state: () => string }

const make = (rt: DemoRuntime): Ctx => ({
  rt,
  job: (type, extra = {}) => { const r = rt.dispatch(JOB_ID, { type, ...extra }); if (!r.ok) throw new Error(`${type}: ${r.error}`); },
  ctx: () => rt.get(JOB_ID)!.snap.ctx as JobCtx,
  state: () => rt.get(JOB_ID)!.snap.state
});

interface BeginOpts { role: RoleName; customerLang: Lang | "app"; proLang: Lang | "app"; categoryId?: string; zoneId?: string; emergency?: boolean; proId?: string; method?: PayMethod; noJob?: boolean; meId?: string; tab?: "request" | "warranty" }

function begin(rt: DemoRuntime, o: BeginOpts, appLang: Lang): void {
  rt.reset();
  resetSession(true);
  const cat = o.categoryId ?? "painting";
  Object.assign(session, { signedIn: true, email: "demo@example.com", tab: "request", proId: o.proId ?? null, method: o.method ?? "card", slotHours: 30 });
  session.draft = { categoryId: cat, description: "Paint the living room walls", photos: 1, measurements: "", zoneId: o.zoneId ?? "z1", street: "[Street and number]", emergency: !!o.emergency };
  Object.assign(psession, { meId: o.meId ?? null, tab: "jobs", idDoc: false, selfie: false, phoneVerified: false, recoverySelfie: false, recoveryPhone: false, before: 0, after: 0, checks: {}, completionChecks: {}, clabe: "", clabeSaved: false });
  photoQueue.reset();
  rt.languages.customer = o.customerLang === "app" ? appLang : o.customerLang;
  rt.languages.professional = o.proLang === "app" ? appLang : o.proLang;
  if (o.noJob) return;
  rt.spawn(JOB_ID, "job", jobMachine, newJobCtx({ needsReview: humanReviewForCategory(cat).length > 0 }), { categoryId: cat });
  const r = rt.dispatch(JOB_ID, { type: o.zoneId === "outside" ? "OUT_OF_AREA" : "ESTIMATE_READY" });
  if (!r.ok) throw new Error(r.error);
}

// ---------- reusable steps ----------
const recs: Step = (c) => c.job("RECOMMENDATIONS_READY");
const select = (id: string): Step => (c) => c.job("SELECT_PROFESSIONAL", { professionalId: id });
const sendQuote = (extra = 0): Step => (c) => {
  const q = buildQuote(session.draft.categoryId, session.draft.emergency);
  const lines = q.lines.map((l) => (l.id === "work" ? { ...l, amount: l.amount + extra } : l));
  c.job("SEND_QUOTE", { total: q.total + extra, travelFee: config.travelFeeBandsMXN.adjacent, payoutRatio: config.demoPayoutRatio, lines, taskId: q.taskId, tier: q.tier });
};
const toQuote = (id: string, extra = 0): Step[] => [recs, select(id), sendQuote(extra)];
const accept = (method: PayMethod, hours: number): Step => (c) => { session.method = method; c.job("ACCEPT_QUOTE", { method, jobStart: addHours(c.rt.clock.now(), hours) }); };

const first = (c: Ctx) => {
  const x = c.ctx();
  return buildSchedule({ method: x.method, total: x.total, jobStart: x.jobStart, now: x.scheduleBasis ?? c.rt.clock.now() }).installments;
};
const isRef = (m: PayMethod) => m === "cash" || m === "spei";
/** Issues the first reference (cash/SPEI) so the customer sees it. */
const refsInitial: Step = (c) => { const i = first(c)[0]!; if (isRef(c.ctx().method) && i.dueAt) ensureReference(c.rt, JOB_ID, i.kind, c.ctx().method as "cash" | "spei", i.amount, i.dueAt); };
const payInitial: Step = (c) => {
  refsInitial(c);
  const i = first(c)[0]!;
  if (isRef(c.ctx().method)) confirmPayment(c.rt, JOB_ID, i.kind);
  c.job("PAYMENT_SATISFIED", { amount: Math.max(c.ctx().initialDue - c.ctx().paid, 1) });
};
const payBalance: Step = (c) => {
  const b = first(c).find((i) => i.kind === "balance");
  if (!b || !b.dueAt) return;
  ensureReference(c.rt, JOB_ID, "balance", c.ctx().method as "cash" | "spei", b.amount, b.dueAt);
  confirmPayment(c.rt, JOB_ID, "balance");
  c.job("BALANCE_PAID");
};
const hours = (h: number): Step => (c) => c.rt.advanceHours(h);
const upToWork: Step = (c) => { for (const e of ["ON_THE_WAY", "CHECK_IN", "START_WORK"]) c.job(e); };
const onTheWay: Step = (c) => c.job("ON_THE_WAY");
const finishWork: Step = (c) => {
  c.job("CHECKLIST_COMPLETE"); c.job("MARK_COMPLETE");
  if (c.state() === "markedComplete") c.job("BALANCE_PAID");
};
const closeWindow: Step = (c) => c.rt.advanceHours(config.completionCheck.autoReleaseHours);
const rate: Step = (c) => c.job("RATE");
const ev = (type: string, extra?: object): Step => (c) => c.job(type, extra);
const caseEv = (type: string, extra: object = {}): Step => (c) => {
  const r = c.rt.dispatch(`case:${JOB_ID}`, { type, ...extra });
  if (!r.ok) throw new Error(`${type}: ${r.error}`);
};
const warrantyEv = (type: string, extra: object = {}): Step => (c) => {
  const r = c.rt.dispatch(`warranty:${JOB_ID}`, { type, ...extra });
  if (!r.ok) throw new Error(`${type}: ${r.error}`);
};
const scheduledCard = (id: string, h: number): Step[] => [...toQuote(id), accept("card", h), payInitial];

const sc = (id: string, o: BeginOpts, steps: Step[], handoffAt: number): Scenario =>
  ({ id, role: o.role, customerLang: o.customerLang, proLang: o.proLang, ...(o.tab ? { tab: o.tab } : {}), steps: [(c) => { void c; }, ...steps], handoffAt: handoffAt + 1 });
const base = (o: Partial<BeginOpts> = {}): BeginOpts => ({ role: "customer", customerLang: "app", proLang: "es", proId: "p2", ...o });
const OPTS = new Map<string, BeginOpts>();
const def = (id: string, o: BeginOpts, steps: Step[], handoffAt: number): Scenario => { OPTS.set(id, o); return sc(id, o, steps, handoffAt); };

export const SCENARIOS: Scenario[] = [
  def("s1", base(), [...toQuote("p2"), accept("card", 30), payInitial, hours(30), upToWork, finishWork, closeWindow, rate], 3),
  def("s2", base({ method: "cash" }), [...toQuote("p2"), accept("cash", 72), refsInitial, payInitial, hours(30), payBalance, hours(42), upToWork, ev("CHECKLIST_COMPLETE"), ev("MARK_COMPLETE")], 5),
  def("s3card", base({ role: "professional" }), [...scheduledCard("p2", 30), hours(30), upToWork, (c) => { session.additionalNote = "Fix the damaged corner"; session.additionalLang = c.rt.languages.professional; c.job("REQUEST_ADDITIONAL_WORK", { amount: 500 }); },
    ev("APPROVE_ADDITIONAL_WORK"), finishWork, closeWindow], 7),
  def("s3cash", base({ role: "professional", method: "cash" }), [...toQuote("p2"), accept("cash", 72), payInitial, payBalance, hours(72), upToWork,
    (c) => { session.additionalNote = "Fix the damaged corner"; session.additionalLang = c.rt.languages.professional; c.job("REQUEST_ADDITIONAL_WORK", { amount: 500 }); },
    ev("APPROVE_ADDITIONAL_WORK"), (c) => { ensureReference(c.rt, JOB_ID, "additional", "cash", 500, null); confirmPayment(c.rt, JOB_ID, "additional"); c.job("ADDITIONAL_WORK_PAID"); },
    ev("CHECKLIST_COMPLETE"), ev("MARK_COMPLETE")], 8),
  def("s4", base({ method: "cash", categoryId: "plumbing", proId: "p1", emergency: true }), [...toQuote("p1"), accept("cash", 4), refsInitial, payInitial, hours(4), upToWork, ev("CHECKLIST_COMPLETE"), ev("MARK_COMPLETE")], 5),
  def("s5", base({ zoneId: "outside" }), [ev("MANUAL_REVIEW_APPROVED"), ...toQuote("p2")], 0),
  def("s6acc", base(), [...scheduledCard("p2", 72), (c) => { requestReschedule(c.rt, JOB_ID, addHours(c.rt.clock.now(), 120)); }, (c) => { if (!acceptReschedule(c.rt, JOB_ID).ok) throw new Error("accept"); }], 6),
  def("s6dec", base(), [...scheduledCard("p2", 72), (c) => { requestReschedule(c.rt, JOB_ID, addHours(c.rt.clock.now(), 120)); }, (c) => { if (!declineReschedule(c.rt, JOB_ID).ok) throw new Error("decline"); }], 6),
  def("s6exp", base(), [...scheduledCard("p2", 72), (c) => { requestReschedule(c.rt, JOB_ID, addHours(c.rt.clock.now(), 120)); }, hours(config.rescheduleResponseHours), ev("CHOOSE_REFUND")], 6),
  def("s7pre", base(), [...scheduledCard("p2", 72), ev("CUSTOMER_CANCELS"), ev("REFUND_ISSUED")], 5),
  def("s7post", base(), [...scheduledCard("p2", 30), hours(30), onTheWay, ev("CUSTOMER_CANCELS"), ev("REFUND_ISSUED")], 7),
  def("s8cancel", base({ role: "professional" }), [...scheduledCard("p2", 30), hours(30), onTheWay, ev("PRO_CANCELS"), (c) => { session.excluded = ["p2"]; session.proId = "p6"; c.job("CHOOSE_REPLACEMENT"); },
    select("p6"), sendQuote(400), accept("card", 30), (c) => c.job("PAYMENT_SATISFIED", { amount: c.ctx().initialDue - c.ctx().paid })], 7),
  def("s8noshow", base(), [...scheduledCard("p2", 30), hours(30), ev("PRO_NO_SHOW"), ev("CHOOSE_REFUND")], 6),
  def("s9", base(), [...scheduledCard("p2", 30), hours(30), upToWork, finishWork, hours(2), ev("REPORT_ISSUE", { selected: ["mat"] }), caseEv("START_REVIEW"), caseEv("DECIDE", { decision: "refundCustomer" }),
    caseEv("REQUEST_REVIEW", { by: "customer" }), caseEv("REVIEW_DECIDED", { decision: "refundCustomer" }), caseEv("REQUEST_REVIEW", { by: "professional" }), caseEv("REVIEW_DECIDED", { decision: "refundCustomer" })], 9),
  def("s10", base({ tab: "warranty" }), [...scheduledCard("p2", 30), hours(30), upToWork, finishWork, closeWindow, warrantyEv("FILE_CLAIM"), warrantyEv("START_REVIEW"), warrantyEv("RESOLVE", { outcome: "resolved" })], 9),
  def("s11", base({ role: "professional", noJob: true, meId: "new" }), [(c) => {
    const id = "verify:new";
    if (!c.rt.get(id)) c.rt.spawn(id, "verification", verificationMachine, newVerification());
    const go = (e: { type: string } & Record<string, unknown>) => { const r = c.rt.dispatch(id, e); if (!r.ok) throw new Error(`${e.type}: ${r.error}`); };
    go({ type: "SUBMIT", idDoc: true, selfie: true, phoneVerified: true }); go({ type: "APPROVE" });
    go({ type: "REPORT_LOST_NUMBER" }); go({ type: "SUBMIT_RECOVERY", selfie: true, newPhoneVerified: true }); go({ type: "APPROVE" });
  }], 0),
  def("s12", base({ customerLang: "ko", proLang: "es" }), [recs, select("p2"), (c) => {
    const [c0, c1] = demoLines("customer", "ko"), [p0, p1] = demoLines("professional", "es");
    c.rt.sendChat(JOB_ID, "customer", "ko", c0!); c.rt.sendChat(JOB_ID, "professional", "es", p0!);
    c.rt.sendChat(JOB_ID, "customer", "ko", c1!); c.rt.sendChat(JOB_ID, "professional", "es", p1!);
  }, sendQuote(), accept("card", 30), payInitial], 2)
];

let active: string | null = null;
/** Runs the scenario up to the point where you take over. Returns the role and language to switch to. */
export function startScenario(rt: DemoRuntime, id: string, appLang: Lang): { role: RoleName; language: Lang } {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario ${id}`);
  begin(rt, OPTS.get(id)!, appLang);
  const c = make(rt);
  s.steps.slice(1, s.handoffAt).forEach((step) => step(c));
  if (s.tab) session.tab = s.tab;
  active = id;
  const language = (s.role === "professional" ? rt.languages.professional : rt.languages.customer) as Lang;
  return { role: s.role, language };
}
/** Plays the rest of the scenario so it runs to its end. */
export function finishScenario(rt: DemoRuntime, id: string): void {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s || active !== id) throw new Error("start the scenario first");
  const c = make(rt);
  s.steps.slice(s.handoffAt).forEach((step) => step(c));
}
