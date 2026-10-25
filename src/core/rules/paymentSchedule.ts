import { config } from "../config/fixx.config";
import { addHours, round2 } from "./time";

export type PayMethod = "card" | "wallet" | "cash" | "spei";
export type MissedAction = "expireBooking" | "cancelJobRefundDeposit" | "expireRequest";
export type Tier = "card" | "far" | "mid" | "near";

export interface Installment {
  kind: "deposit" | "balance" | "full";
  amount: number;
  /** null = no fixed time; see `trigger`. */
  dueAt: Date | null;
  trigger?: "quoteAccepted" | "jobComplete";
  onMissed?: MissedAction;
}
export interface Schedule { tier: Tier; installments: Installment[] }

export function splitDepositBalance(total: number, depositPct: number = config.deposit.sharePct) {
  const deposit = round2((total * depositPct) / 100);
  return { deposit, balance: round2(total - deposit) }; // balance is the remainder, so the parts always sum to the total
}

/**
 * Payment deadlines. Call again with the new job time (and the current time) after a reschedule:
 * deadlines recalculate from the new time.
 * ASSUMPTIONS (see DECISIONS.md G1): "far" = strictly more than 48 h away; "mid" = 24 h up to and including 48 h;
 * "near" = under 24 h. Cards/wallets use the same rules at every distance.
 */
export function buildSchedule(
  input: { method: PayMethod; total: number; jobStart: Date; now: Date },
  cfg: typeof config = config
): Schedule {
  const { method, total, jobStart, now } = input;
  if (!(total > 0)) throw new RangeError("total must be greater than 0");
  const { deposit, balance } = splitDepositBalance(total, cfg.deposit.sharePct);
  const p = cfg.payment;

  if (method === "card" || method === "wallet") {
    return { tier: "card", installments: [
      { kind: "deposit", amount: deposit, dueAt: now, trigger: "quoteAccepted" },
      { kind: "balance", amount: balance, dueAt: null, trigger: "jobComplete" }
    ] };
  }

  const hoursAway = (jobStart.getTime() - now.getTime()) / 3_600_000;
  const before = addHours(jobStart, -p.balanceDueHoursBefore);

  if (hoursAway > p.farJobHours) {
    return { tier: "far", installments: [
      { kind: "deposit", amount: deposit, dueAt: addHours(now, p.depositDueHoursFar), onMissed: "expireBooking" },
      { kind: "balance", amount: balance, dueAt: before, onMissed: "cancelJobRefundDeposit" }
    ] };
  }
  if (hoursAway >= p.nearJobHours) {
    return { tier: "mid", installments: [
      { kind: "deposit", amount: deposit, dueAt: before, onMissed: "expireBooking" },
      { kind: "balance", amount: balance, dueAt: before, onMissed: "cancelJobRefundDeposit" }
    ] };
  }
  return { tier: "near", installments: [
    { kind: "full", amount: round2(total), dueAt: addHours(now, p.fullDueHoursWithin24), onMissed: "expireRequest" }
  ] };
}

export interface AdditionalWorkPlan {
  amount: number;
  chargeTiming: "afterCompletion" | "byReference";
  addedToBalance: boolean;
  /** Cash/SPEI: the job cannot be marked complete until this is paid. No separate deposit either way. */
  blocksCompletion: boolean;
}
export function planAdditionalWork(method: PayMethod, amount: number): AdditionalWorkPlan {
  if (!(amount > 0)) throw new RangeError("amount must be greater than 0");
  const card = method === "card" || method === "wallet";
  return { amount: round2(amount), chargeTiming: card ? "afterCompletion" : "byReference", addedToBalance: card, blocksCompletion: !card };
}
