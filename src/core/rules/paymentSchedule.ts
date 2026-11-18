import { roundUpToCentavo } from "../../config/revenue";
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

/**
 * 20% deposit and 80% balance. The deposit rounds up to the next centavo.
 * The balance is the rest, so the two parts add up to the centavo total.
 * A total that is already a centavo keeps its original number.
 */
export function splitDepositBalance(total: number, depositPct: number = config.deposit.sharePct) {
  const rounded = roundUpToCentavo(total);
  const priced = Math.round(total * 100) === Math.round(rounded * 100) ? total : rounded;
  const deposit = roundUpToCentavo(rounded * depositPct / 100);
  const balance = (Math.round(rounded * 100) - Math.round(deposit * 100)) / 100;
  return { total: priced, deposit, balance };
}

export interface IncreaseShare {
  /** Full increase added to the job total. */
  total: number;
  /** Same deposit share as the quote, rounded up to the next centavo. */
  upfront: number;
  /** Remainder, added to the balance. */
  balance: number;
}

/**
 * Quote hold plus every approved increase. Each increase uses the same 20/80 split.
 */
export interface BookingHold {
  quoted: number;
  increases: readonly IncreaseShare[];
  upfront: number;
  balance: number;
  total: number;
}

function shareOf(amount: number, depositPct: number): IncreaseShare {
  const split = splitDepositBalance(amount, depositPct);
  return { total: split.total, upfront: split.deposit, balance: split.balance };
}

export function bookingHold(quoted: number, increases: readonly number[] = [], depositPct: number = config.deposit.sharePct): BookingHold {
  const quote = shareOf(quoted, depositPct);
  const shares = increases.map((amount) => shareOf(amount, depositPct));
  const upfront = roundUpToCentavo(quote.upfront + shares.reduce((sum, item) => sum + item.upfront, 0));
  const balance = roundUpToCentavo(quote.balance + shares.reduce((sum, item) => sum + item.balance, 0));
  return { quoted: quote.total, increases: shares, upfront, balance, total: roundUpToCentavo(upfront + balance) };
}

/** An approved increase joins the hold with the same 20/80 split. The full increase is in the new total. */
export function addToHold(hold: BookingHold, increase: number): BookingHold {
  if (!(increase > 0)) throw new RangeError("increase must be greater than 0");
  return bookingHold(hold.quoted, [...hold.increases.map((item) => item.total), increase]);
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
  /** Full increase added to the job total. */
  amount: number;
  /** 20% due up front. */
  upfront: number;
  /** 80% added to the balance. */
  balance: number;
  chargeTiming: "afterCompletion" | "byReference";
  addedToBalance: boolean;
  /** Cash/SPEI: the job cannot be marked complete until this is paid. No separate deposit either way. */
  blocksCompletion: boolean;
}
export function planAdditionalWork(method: PayMethod, amount: number): AdditionalWorkPlan {
  if (!(amount > 0)) throw new RangeError("amount must be greater than 0");
  const split = splitDepositBalance(amount);
  const card = method === "card" || method === "wallet";
  return {
    amount: split.total,
    upfront: split.deposit,
    balance: split.balance,
    chargeTiming: card ? "afterCompletion" : "byReference",
    addedToBalance: card,
    blocksCompletion: !card
  };
}
