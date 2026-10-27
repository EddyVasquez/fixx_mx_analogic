import { config } from "../config/fixx.config";
import { splitDepositBalance } from "./paymentSchedule";
import { addHours, round2 } from "./time";

export interface CompletionReminder {
  id: string;
  hours: number;
  label: string;
  at: Date;
}

/** When the balance releases on its own, and the reminder times before that. All values come from config. */
export function completionWindow(completedAt: Date, cfg: typeof config = config) {
  const c = cfg.completionCheck;
  return {
    endsAt: addHours(completedAt, c.autoReleaseHours),
    autoReleaseLabel: c.autoReleaseLabel,
    reminders: c.reminders.map((r): CompletionReminder => ({
      id: r.id, hours: r.hours, label: r.label, at: addHours(completedAt, r.hours)
    }))
  };
}

/** Whole hours left until a deadline, never negative. */
export function hoursUntil(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 3_600_000));
}

/** The customer's balance: the job total minus the deposit share. */
export function customerBalance(total: number, cfg: typeof config = config): number {
  return splitDepositBalance(total, cfg.deposit.sharePct).balance;
}

export function customerDeposit(total: number, cfg: typeof config = config): number {
  return splitDepositBalance(total, cfg.deposit.sharePct).deposit;
}

/**
 * What the professional still has pending. This is their net payout, never a rate or a margin.
 * After a problem report, only the held share is still pending.
 */
export function professionalPendingBalance(ctx: { total: number; payoutRatio: number; heldPayout?: number; releasedPayout?: number }): number {
  if ((ctx.releasedPayout ?? 0) > 0 || (ctx.heldPayout ?? 0) > 0) return round2(ctx.heldPayout ?? 0);
  return round2(ctx.total * ctx.payoutRatio);
}

export interface CompletionItem { id: string; group: "core" | "trade" }

/** Generic core, then the trade items from config. Unknown trades get the core only. */
export function completionItems(categoryId: string, cfg: typeof config = config): CompletionItem[] {
  const c = cfg.completionCheck;
  const core = c.coreItems.map((id): CompletionItem => ({ id, group: "core" }));
  const trade = (c.tradeItems[categoryId] ?? []).map((id): CompletionItem => ({ id, group: "trade" }));
  return [...core, ...trade];
}
