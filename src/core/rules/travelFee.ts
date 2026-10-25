import { config } from "../config/fixx.config";
import { round2 } from "./time";

export type Band = "same" | "adjacent" | "far";
export interface ZoneLike { id: string; adjacentTo: readonly string[] }

/** Distance band from the professional's zone to the customer's zone. Unknown zones count as "far" (decision P8). */
export function bandFor(professionalZone: string, customerZone: string, zones: readonly ZoneLike[]): Band {
  if (professionalZone === customerZone) return "same";
  const z = zones.find((x) => x.id === professionalZone);
  return z?.adjacentTo.includes(customerZone) ? "adjacent" : "far";
}
export const travelFeeFor = (band: Band, cfg: typeof config = config): number => cfg.travelFeeBandsMXN[band];

export type CancelStage = "beforeOnTheWay" | "afterOnTheWay";
export interface CancelOutcome {
  refund: number; travelFeeCharged: number; toProfessional: number; fullRefund: boolean; noRefund: boolean;
}
/** Customer cancels. Before "on the way": free, full refund. After: refund minus the travel fee, never more than was paid. */
export function customerCancellation(i: { stage: CancelStage; paid: number; travelFee: number }): CancelOutcome {
  const fee = i.stage === "beforeOnTheWay" ? 0 : round2(Math.min(i.travelFee, i.paid));
  const refund = round2(i.paid - fee);
  return { refund, travelFeeCharged: fee, toProfessional: fee, fullRefund: fee === 0, noRefund: refund === 0 };
}
