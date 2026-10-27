import type { Audience, Channel, Effect } from "../../core/machines/machine";
import type { Lang } from "../../core/config/fixx.config";

export type Params = Record<string, string | number | boolean>;
export interface NotificationRecord {
  id: string; at: string; channel: Channel; audience: Audience; language: Lang; template: string; params: Params; actorId: string;
}
type NotifyEffect = Extract<Effect, { type: "notify" }>;

/**
 * Simulated delivery. Nothing is sent anywhere. One record per audience and channel, in the recipient's language.
 * WhatsApp and push only reach customers and professionals; Admin and Support get in-app and email.
 */
export class NotificationCenter {
  private records: NotificationRecord[] = [];
  private seq = 1;
  private listeners = new Set<() => void>();

  deliver(fx: NotifyEffect, ctx: { at: Date; actorId: string; languageOf: (a: Audience) => Lang; extraParams?: Params }): NotificationRecord[] {
    const out: NotificationRecord[] = [];
    for (const audience of fx.audience) {
      const external = audience === "customer" || audience === "professional";
      let channels = external ? fx.channels : fx.channels.filter((c) => c === "inApp" || c === "email");
      if (channels.length === 0) channels = ["inApp"];
      for (const channel of channels) {
        out.push({
          id: `n-${this.seq++}`, at: ctx.at.toISOString(), channel, audience, language: ctx.languageOf(audience),
          template: fx.template, params: { ...ctx.extraParams, ...fx.params }, actorId: ctx.actorId
        });
      }
    }
    this.records.push(...out);
    this.listeners.forEach((l) => l());
    return out;
  }
  /** Newest first. */
  list(filter?: { audience?: Audience; channel?: Channel }): NotificationRecord[] {
    return this.records
      .filter((r) => (!filter?.audience || r.audience === filter.audience) && (!filter?.channel || r.channel === filter.channel))
      .slice().reverse();
  }
  clear(): void { this.records = []; this.listeners.forEach((l) => l()); }
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
}

const MONEY = new Set(["amount", "travelFee", "refund", "held", "heldPayout", "released", "releasedPayout"]);
type T = (key: string | string[], opts?: Record<string, unknown>) => string;

/**
 * Text for a record. Looks for copy written for that audience or outcome first, then the shared copy.
 * Money params are formatted per locale before they reach the string.
 */
export function notificationText(rec: NotificationRecord, t: T, fmtMoney: (n: number) => string): string {
  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec.params)) params[k] = MONEY.has(k) && typeof v === "number" ? fmtMoney(v) : v;
  const keys = [`notif.${rec.template}.${rec.audience}`];
  if (typeof rec.params["outcome"] === "string") keys.push(`notif.${rec.template}.${rec.params["outcome"]}`);
  keys.push(`notif.${rec.template}`);
  return t(keys, { ...params, lng: rec.language });
}
