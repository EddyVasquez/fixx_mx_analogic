import { roundUpToCentavo } from "@/config/revenue";
import { splitDepositBalance } from "@/core/rules/paymentSchedule";
import { addHours } from "@/core/rules/time";

/** Catalog trades that always go to a FIXX agent. Gas has no catalog id yet. */
export const REGULATED_TRADES = ["electrical", "hvac", "pest_control", "gas"] as const;

export const EXTRA_WORK = {
  autoLimitPct: 25,
  closeFromPct: 20,
  proposalHours: 72,
  reminderEveryHours: 24,
  newQuoteDays: 7,
  deliveryMxn: { moto: 120, van: 1450 }
} as const;

/**
 * E8 is waiting on a legal check. The confirm screen is the consent.
 * Change this one object if the wording or the decision changes.
 */
export const INCREASE_CONSENT = {
  id: "E8",
  pendingLegalCheck: true,
  countsAsConsent: true
} as const;

export type ExtraWorkLevel = "within" | "close" | "review" | "new-work-order";
export type ReviewReason = "over-25" | "regulated" | "unlisted" | "different-trade" | "safety" | "new-delivery";

export interface ExtraWorkInput {
  originalNte: number;
  /** Approved increases already on this job, including their delivery. */
  priorApproved: number;
  /** This proposal's customer price before a new delivery line. */
  increase: number;
  delivery?: number | null;
  regulated?: boolean;
  isUnlisted?: boolean;
  differentTrade?: boolean;
  safety?: boolean;
  newDeliveryTrip?: boolean;
}

export interface ExtraWorkRoute {
  combined: number;
  /** Combined increase as a percent of the original NTE. */
  pct: number;
  level: ExtraWorkLevel;
  requiresAgentReview: boolean;
  reasons: ReviewReason[];
}

/** One place that decides whether an increase goes straight to the customer. */
export function routeExtraWork(input: ExtraWorkInput): ExtraWorkRoute {
  const delivery = input.delivery ?? 0;
  const combined = roundUpToCentavo(input.priorApproved + input.increase + delivery);
  const pct = input.originalNte > 0 ? (combined / input.originalNte) * 100 : 0;
  const reasons: ReviewReason[] = [];
  if (input.differentTrade) reasons.push("different-trade");
  if (input.regulated) reasons.push("regulated");
  if (input.isUnlisted) reasons.push("unlisted");
  if (input.safety) reasons.push("safety");
  if (input.newDeliveryTrip) reasons.push("new-delivery");
  if (!input.differentTrade && pct > EXTRA_WORK.autoLimitPct) reasons.push("over-25");
  const requiresAgentReview = reasons.length > 0;
  let level: ExtraWorkLevel = "within";
  if (input.differentTrade) level = "new-work-order";
  else if (requiresAgentReview || pct > EXTRA_WORK.autoLimitPct) level = "review";
  else if (pct >= EXTRA_WORK.closeFromPct) level = "close";
  return { combined, pct, level, requiresAgentReview, reasons };
}

/** 20% rounds up. The balance is the rest, so the two parts equal the increase. */
export function increaseSplit(amount: number) {
  return splitDepositBalance(amount);
}

export function proposalDeadline(sentAt: Date): Date {
  return addHours(sentAt, EXTRA_WORK.proposalHours);
}

/** Once a day until the 72-hour deadline. A pause shifts both reminders. */
export function proposalReminders(sentAt: Date, pausedMs = 0): Date[] {
  const start = sentAt.getTime() + pausedMs;
  const end = proposalDeadline(new Date(start)).getTime();
  const out: Date[] = [];
  for (let step = 1; step * EXTRA_WORK.reminderEveryHours < EXTRA_WORK.proposalHours; step += 1) {
    const at = start + step * EXTRA_WORK.reminderEveryHours * 3_600_000;
    if (at < end) out.push(new Date(at));
  }
  return out;
}

/** Time left on the 72-hour clock. While paused, the clock stays where it stopped. */
export function proposalRemainingMs(sentAt: Date, now: Date, pausedAt: Date | null, pausedMs: number): number {
  const end = proposalDeadline(sentAt).getTime() + pausedMs;
  const clock = pausedAt ? pausedAt.getTime() : now.getTime();
  return Math.max(0, end - clock);
}

export function isProposalExpired(sentAt: Date, now: Date, pausedAt: Date | null, pausedMs: number): boolean {
  return pausedAt == null && proposalRemainingMs(sentAt, now, null, pausedMs) === 0 && now.getTime() >= proposalDeadline(sentAt).getTime() + pausedMs;
}

/** Verified work already done cannot be billed above the original not-to-exceed price. */
export function declineChargeCap(originalNte: number, verifiedAmount: number): number {
  return Math.min(roundUpToCentavo(Math.max(0, verifiedAmount)), roundUpToCentavo(Math.max(0, originalNte)));
}

export function isRegulatedTrade(tradeId: string): boolean {
  return (REGULATED_TRADES as readonly string[]).includes(tradeId);
}
