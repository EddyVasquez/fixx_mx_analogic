/**
 * Tiny typed state-machine core (a typed reducer, as the brief allows).
 * Pure: send() returns a new snapshot plus effects as DATA (notifications, timers, refunds...).
 * Step 5 interprets the effects; nothing here touches the DOM, the database or the real clock.
 */
export type Audience = "customer" | "professional" | "admin" | "support";
export type Channel = "push" | "whatsapp" | "email" | "inApp";

export type Effect =
  | { type: "notify"; template: string; audience: Audience[]; channels: Channel[]; params: Record<string, string | number | boolean> }
  | { type: "timer"; at: Date; event: { type: string }; label: string }
  | { type: "recalculatePayments" }
  | { type: "createRefund"; amount: number; destination: "original" | "clabe" }
  | { type: "createCase"; heldAmount: number; heldPayout: number; wholeJob: boolean }
  | { type: "qualityPenalty"; professionalId: string | null; reason: string }
  | { type: "releasePayout" }
  | { type: "startWarranty" };

/** Every transition must emit at least one notification (checked in send). */
export function notify(
  template: string, audience: Audience[], kind: "realtime" | "urgent" | "record" = "realtime",
  params: Record<string, string | number | boolean> = {}
): Effect {
  const channels: Channel[] = kind === "realtime" ? ["push", "inApp"] : kind === "urgent" ? ["push", "whatsapp", "inApp"] : ["email", "inApp"];
  return { type: "notify", template, audience, channels, params };
}

export type Outcome<S extends string, C> = { target: S; ctx?: Partial<C>; effects: Effect[] } | { reject: string };
export type Handler<S extends string, C, Ev> = (ctx: C, ev: Ev, now: Date) => Outcome<S, C>;
export type Handlers<S extends string, E extends { type: string }, C> = {
  [St in S]?: { [T in E["type"]]?: Handler<S, C, Extract<E, { type: T }>> };
};
export interface MachineDef<S extends string, E extends { type: string }, C> { id: string; initial: S; on: Handlers<S, E, C> }

export interface HistoryEntry<S> { from: S; to: S; event: string; at: string }
export interface Snapshot<S extends string, C> { state: S; ctx: C; history: HistoryEntry<S>[] }
export type SendResult<S extends string, C> =
  | { ok: true; snapshot: Snapshot<S, C>; effects: Effect[] }
  | { ok: false; error: string; snapshot: Snapshot<S, C> };

export const createSnapshot = <S extends string, E extends { type: string }, C>(def: MachineDef<S, E, C>, ctx: C): Snapshot<S, C> =>
  ({ state: def.initial, ctx, history: [] });

export function send<S extends string, E extends { type: string }, C>(
  def: MachineDef<S, E, C>, snap: Snapshot<S, C>, ev: E, now: Date
): SendResult<S, C> {
  const table = def.on[snap.state] as Record<string, Handler<S, C, E> | undefined> | undefined;
  const handler = table?.[ev.type];
  if (!handler) return { ok: false, error: `${def.id}: "${ev.type}" is not allowed in "${snap.state}"`, snapshot: snap };
  const out = handler(snap.ctx, ev, now);
  if ("reject" in out) return { ok: false, error: out.reject, snapshot: snap };
  if (!out.effects.some((e) => e.type === "notify")) {
    throw new Error(`${def.id}: ${snap.state} --${ev.type}--> ${out.target} has no notification`);
  }
  return {
    ok: true, effects: out.effects,
    snapshot: {
      state: out.target, ctx: { ...snap.ctx, ...out.ctx },
      history: [...snap.history, { from: snap.state, to: out.target, event: ev.type, at: now.toISOString() }]
    }
  };
}

export const allowedEvents = <S extends string, E extends { type: string }, C>(def: MachineDef<S, E, C>, state: S): string[] =>
  Object.keys(def.on[state] ?? {});
export const reject = (reason: string): { reject: string } => ({ reject: reason });
