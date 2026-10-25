import { notify, reject, type Effect, type MachineDef, type Outcome } from "./machine";

export type VerificationState = "notStarted" | "pending" | "approved" | "rejected" | "recovery";
export type VerificationEvent =
  | { type: "SUBMIT"; idDoc: boolean; selfie: boolean; phoneVerified: boolean }
  | { type: "APPROVE" } | { type: "REJECT"; reason: string }
  | { type: "REPORT_LOST_NUMBER" } | { type: "SUBMIT_RECOVERY"; selfie: boolean; newPhoneVerified: boolean };
export interface VerificationCtx { idDoc: boolean; selfie: boolean; phoneVerified: boolean; reason: string | null; recovery: boolean }
export const newVerification = (): VerificationCtx => ({ idDoc: false, selfie: false, phoneVerified: false, reason: null, recovery: false });

const P = ["professional" as const];
const go = (t: VerificationState, fx: Effect[], ctx?: Partial<VerificationCtx>): Outcome<VerificationState, VerificationCtx> => ({ target: t, effects: fx, ...(ctx ? { ctx } : {}) });
const submit = (_c: VerificationCtx, e: Extract<VerificationEvent, { type: "SUBMIT" }>) =>
  e.idDoc && e.selfie && e.phoneVerified
    ? go("pending", [notify("verification.submitted", P), notify("admin.verificationQueue", ["admin"])], { idDoc: true, selfie: true, phoneVerified: true, reason: null })
    : reject("ID, selfie and phone are all required");

/** FIXX Verified confirms identity only. Never implies verified skills, licenses or insurance. */
export const verificationMachine: MachineDef<VerificationState, VerificationEvent, VerificationCtx> = {
  id: "verification", initial: "notStarted",
  on: {
    notStarted: { SUBMIT: submit },
    rejected: { SUBMIT: submit },
    pending: {
      APPROVE: () => go("approved", [notify("verification.approved", P, "urgent")], { recovery: false }),
      REJECT: (_c, e) => e.reason.trim() ? go("rejected", [notify("verification.rejected", P, "urgent")], { reason: e.reason }) : reject("a reason is required")
    },
    approved: { REPORT_LOST_NUMBER: () => go("recovery", [notify("verification.recoveryStarted", P, "urgent"), notify("admin.verificationQueue", ["admin"])], { recovery: true, phoneVerified: false }) },
    recovery: {
      SUBMIT_RECOVERY: (_c, e) => e.selfie && e.newPhoneVerified
        ? go("pending", [notify("verification.submitted", P), notify("admin.verificationQueue", ["admin"])], { selfie: true, phoneVerified: true })
        : reject("a new selfie and the new phone number are required")
    }
  }
};
