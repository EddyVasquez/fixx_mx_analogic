import { config, type Lang } from "../../core/config/fixx.config";
import { Clock } from "../../core/clock/clock";
import { Scheduler } from "../../core/clock/scheduler";
import { send, type Audience, type Effect, type MachineDef, type Snapshot, createSnapshot } from "../../core/machines/machine";
import { newCase, caseMachine, type CaseCtx } from "../../core/machines/issueCase";
import { newWarranty, warrantyMachine } from "../../core/machines/warranty";
import { buildSchedule, isValidClabe, refundDestination, refundExpectedBy, round2 } from "../../core/rules";
import { NotificationCenter, type Params } from "../notifications/center";
import { ChatStore } from "../chat/chatStore";
import { SupportStore } from "../support/supportStore";

export interface Actor { id: string; kind: "job" | "case" | "warranty" | "verification" | "payment" | "reschedule" | "support"; def: MachineDef<string, { type: string }, any>; snap: Snapshot<string, any>; meta: { categoryId?: string; jobId?: string; payoutDeduction?: number } }
export interface RefundRecord { id: string; actorId: string; amount: number; destination: "original" | "clabe"; at: string; expectedBy: string; clabe?: string }
export interface PenaltyRecord { actorId: string; professionalId: string | null; reason: string; at: string }
export interface PayoutRecord { actorId: string; amount: number; at: string }
export interface NoteRecord { id: string; entity: "job" | "professional" | "homeowner"; text: string; at: string }
export interface ScoreChange { professionalId: string; delta: number; reason: string; at: string }
export interface LogEntry { at: string; actorId: string; event: string; from: string; to: string; ok: boolean; error?: string }

/**
 * Applies machine effects: notifications go to the notification center, timers go to the scheduler,
 * refunds / penalties / payouts are recorded. Advancing the clock fires every timer that became due, in order.
 * Everything is simulated and kept in memory (reset clears it).
 */
export class DemoRuntime {
  readonly scheduler = new Scheduler();
  readonly center = new NotificationCenter();
  readonly chat = new ChatStore();
  readonly support = new SupportStore();
  refunds: RefundRecord[] = [];
  penalties: PenaltyRecord[] = [];
  payouts: PayoutRecord[] = [];
  log: LogEntry[] = [];
  /** Internal Admin notes. Never shown to customers or professionals. */
  notes: NoteRecord[] = [];
  scoreChanges: ScoreChange[] = [];
  languages: Record<Audience, Lang> = { customer: "es", professional: "es", admin: "en", support: "es" };
  private actors = new Map<string, Actor>();
  private listeners = new Set<() => void>();
  private version = 0;
  private seq = 1;

  constructor(readonly clock: Clock) {}

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = (): number => this.version;
  private emit(): void { this.version++; this.listeners.forEach((l) => l()); }

  spawn<S extends string, E extends { type: string }, C>(id: string, kind: Actor["kind"], def: MachineDef<S, E, C>, ctx: C, meta: Actor["meta"] = {}, initialState?: S): Actor {
    const snap = createSnapshot(def, ctx) as Snapshot<string, any>;
    const actor: Actor = { id, kind, def: def as unknown as Actor["def"], snap: initialState ? { ...snap, state: initialState } : snap, meta };
    this.actors.set(id, actor);
    this.emit();
    return actor;
  }
  get(id: string): Actor | undefined { return this.actors.get(id); }
  list(kind?: Actor["kind"]): Actor[] { return [...this.actors.values()].filter((a) => !kind || a.kind === kind); }
  /** For modules that change state outside dispatch (e.g. the support store). */
  touch(): void { this.emit(); }

  addNote(entity: NoteRecord["entity"], text: string): boolean {
    if (!text.trim()) return false;
    this.notes.push({ id: `note-${this.seq++}`, entity, text: text.trim(), at: this.clock.now().toISOString() });
    this.emit();
    return true;
  }
  /** A manual Quality Score adjustment by Admin. Automatic penalties are recorded separately; their size is undecided. */
  recordScoreChange(professionalId: string, delta: number, reason: string): boolean {
    if (!Number.isFinite(delta) || delta === 0 || !reason.trim()) return false;
    this.scoreChanges.push({ professionalId, delta, reason: reason.trim(), at: this.clock.now().toISOString() });
    this.emit();
    return true;
  }
  /** Admin sets the held amount of a case before it is decided. It cannot exceed the job total. */
  setCaseHeld(jobId: string, amount: number): boolean {
    const a = this.actors.get(`case:${jobId}`), job = this.actors.get(jobId);
    if (!a || !job || (a.snap.state !== "reported" && a.snap.state !== "underReview")) return false;
    if (!(amount > 0) || amount > job.snap.ctx.total) return false;
    a.snap = { ...a.snap, ctx: { ...a.snap.ctx, heldAmount: round2(amount), heldPayout: round2(amount * job.snap.ctx.payoutRatio) } };
    this.emit();
    return true;
  }

  dispatch(id: string, event: { type: string } & Record<string, unknown>, at: Date = this.clock.now()): { ok: boolean; error?: string } {
    const actor = this.actors.get(id);
    if (!actor) return { ok: false, error: `no actor ${id}` };
    const res = send(actor.def, actor.snap, event, at);
    this.log.push({ at: at.toISOString(), actorId: id, event: event.type, from: actor.snap.state, to: res.snapshot.state, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
    if (!res.ok) { this.emit(); return { ok: false, error: res.error }; }
    actor.snap = res.snapshot;
    for (const fx of res.effects) this.apply(actor, fx, at);
    if (actor.kind === "case") this.afterCase(actor, at);
    this.emit();
    return { ok: true };
  }

  /** Applies effects (messages, timers...) on behalf of an actor outside a machine transition. */
  announce(actorId: string, effects: Effect[], at: Date = this.clock.now()): void {
    const a = this.actors.get(actorId);
    if (!a) return;
    for (const fx of effects) this.apply(a, fx, at);
    this.emit();
  }

  /** Cash and SPEI refunds go to a CLABE the customer provides (18 digits). Returns false if it is not valid. */
  provideClabe(refundId: string, clabe: string): boolean {
    const r = this.refunds.find((x) => x.id === refundId);
    if (!r || r.destination !== "clabe" || !isValidClabe(clabe)) return false;
    r.clabe = clabe.replace(/[\s-]/g, "");
    this.emit();
    return true;
  }

  /** Removes actors whose id starts with the prefix, with their timers (used when deadlines are recalculated). */
  dropPrefix(prefix: string): void {
    for (const id of [...this.actors.keys()]) if (id.startsWith(prefix)) this.actors.delete(id);
    this.scheduler.cancel((t) => t.actorId.startsWith(prefix));
  }

  /** A chat message in the sender's language; every other language is translated by the mock. */
  sendChat(jobId: string, role: "customer" | "professional", language: Lang, text: string): void {
    this.chat.send(jobId, role, language, text, this.clock.now());
    this.emit();
  }

  /** Jump the demo clock forward and fire everything that became due. */
  advanceHours(h: number): void { this.clock.advanceHours(h); this.runDue(); }
  runDue(): void {
    let t = this.scheduler.takeNextDue(this.clock.now());
    while (t) {
      this.dispatch(t.actorId, t.event, t.at); // stale timers are refused by the machine and only logged
      t = this.scheduler.takeNextDue(this.clock.now());
    }
    this.emit();
  }

  reset(): void {
    this.actors.clear(); this.scheduler.clear(); this.center.clear(); this.chat.clear(); this.support.clear(); this.notes = []; this.scoreChanges = [];
    this.refunds = []; this.penalties = []; this.payouts = []; this.log = [];
    this.clock.reset();
    this.emit();
  }

  /**
   * Case follow-ups: the review deadline becomes a timer, and a final decision settles the held amount
   * (refund to the customer, release to the professional, or split) and lets the job release its payment.
   */
  private afterCase(actor: Actor, at: Date): void {
    const jobId = actor.meta.jobId;
    if (!jobId) return;
    const c = actor.snap.ctx as CaseCtx;
    if (actor.snap.state === "decided" && c.reviewBy) {
      // one second after the deadline: the machine only finalizes strictly after it
      this.scheduler.add(actor.id, new Date(c.reviewBy.getTime() + 1000), { type: "DEADLINE_PASSED" }, "case review deadline");
    }
    if (actor.snap.state === "final") {
      const job = this.actors.get(jobId);
      if (!job) return;
      const share = c.decision === "refundCustomer" ? 1 : c.decision === "split" ? 0.5 : 0;
      if (share > 0) this.apply(job, { type: "createRefund", amount: round2(c.heldAmount * share), destination: refundDestination(job.snap.ctx.method) }, at);
      job.meta.payoutDeduction = round2(c.heldPayout * share);
      this.dispatch(jobId, { type: "CASE_RESOLVED" }, at);
    }
  }

  private params(): Params {
    return {
      issueHours: config.issueWindowHours, reminderHours: config.issueReminderHoursBefore, rescheduleHours: config.rescheduleResponseHours,
      refundDays: config.refundBusinessDays, followUpHours: config.outOfAreaFollowUpHours,
      depositHours: config.payment.depositDueHoursFar, fullDueHours: config.payment.fullDueHoursWithin24
    };
  }

  private apply(actor: Actor, fx: Effect, at: Date): void {
    switch (fx.type) {
      case "notify":
        this.center.deliver(fx, { at, actorId: actor.id, languageOf: (a) => this.languages[a], extraParams: this.params() });
        break;
      case "timer":
        this.scheduler.add(actor.id, fx.at, fx.event, fx.label);
        break;
      case "recalculatePayments":
        this.recalculate(actor, at);
        break;
      case "createRefund":
        this.refunds.push({ id: `r-${this.seq++}`, actorId: actor.id, amount: fx.amount, destination: fx.destination, at: at.toISOString(), expectedBy: refundExpectedBy(at).toISOString() });
        break;
      case "createCase":
        this.spawn(`case:${actor.id}`, "case", caseMachine, newCase(at, fx.heldAmount, fx.heldPayout), { jobId: actor.id });
        break;
      case "qualityPenalty":
        this.penalties.push({ actorId: actor.id, professionalId: fx.professionalId, reason: fx.reason, at: at.toISOString() });
        break;
      case "releasePayout": {
        const ctx = actor.snap.ctx as { total: number; payoutRatio: number; releasedPayout?: number };
        const gross = round2(ctx.total * ctx.payoutRatio - (actor.meta.payoutDeduction ?? 0));
        const already = ctx.releasedPayout ?? 0;
        const amount = fx.amount != null ? fx.amount : round2(Math.max(0, gross - already));
        if (amount > 0) this.payouts.push({ actorId: actor.id, amount, at: at.toISOString() });
        break;
      }
      case "startWarranty": {
        const cat = actor.meta.categoryId;
        if (!cat) break;
        const w = newWarranty(at, cat);
        const id = `warranty:${actor.id}`;
        this.spawn(id, "warranty", warrantyMachine, w, { jobId: actor.id });
        this.scheduler.add(id, w.endsAt, { type: "EXPIRE" }, "warranty ends");
        break;
      }
    }
  }

  /** Rebuilds cash/SPEI deadline timers from the job's current time (used after acceptance and after a reschedule). */
  private recalculate(actor: Actor, at: Date): void {
    if (actor.kind !== "job") return;
    this.scheduler.cancel((t) => t.actorId === actor.id && t.label.endsWith(" due"));
    this.dropPrefix(`pay:${actor.id}:`); // payment references are re-created from the new deadlines
    const c = actor.snap.ctx as { method: string; total: number; jobStart: Date; balancePaid: boolean };
    if (c.method === "card" || c.method === "wallet") return;
    const state = actor.snap.state;
    if (state !== "awaitingDeposit" && state !== "scheduled") return;
    const sch = buildSchedule({ method: c.method as "cash" | "spei", total: c.total, jobStart: c.jobStart, now: at });
    sch.installments.forEach((i, idx) => {
      if (!i.dueAt) return;
      if (idx === 0 && state === "awaitingDeposit") this.scheduler.add(actor.id, i.dueAt, { type: "BOOKING_EXPIRED" }, `${i.kind} due`);
      if (idx > 0 && !c.balancePaid) this.scheduler.add(actor.id, i.dueAt, { type: "BALANCE_OVERDUE" }, `${i.kind} due`);
    });
  }
}
