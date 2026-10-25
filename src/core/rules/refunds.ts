import { config } from "../config/fixx.config";
import { addBusinessDays } from "./time";
import type { PayMethod } from "./paymentSchedule";

export type RefundDestination = "original" | "clabe";
/** Cards and wallets go back to the original method; cash and SPEI need a CLABE from the customer. */
export const refundDestination = (m: PayMethod): RefundDestination => (m === "card" || m === "wallet" ? "original" : "clabe");
/** Format check only (18 digits). The check digit is not enforced in the demo. */
export const isValidClabe = (v: string): boolean => /^\d{18}$/.test(v.replace(/[\s-]/g, ""));
export const refundExpectedBy = (now: Date, cfg: typeof config = config): Date => addBusinessDays(now, cfg.refundBusinessDays, cfg.holidays2026);
