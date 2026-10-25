import { paymentMachine } from "../../core/machines/payment";
import type { DemoRuntime } from "./runtime";
import { cashReference, speiDetails } from "../payments/gateway";

export type PayKind = "deposit" | "balance" | "full" | "additional";
const idFor = (jobId: string, kind: PayKind) => `pay:${jobId}:${kind}`;

/**
 * Creates (once) the payment for a cash or SPEI installment: a reference is issued, the customer is told,
 * and a timer expires it at the deadline. Safe to call on every render.
 */
export function ensureReference(rt: DemoRuntime, jobId: string, kind: PayKind, method: "cash" | "spei", amount: number, dueAt: Date | null): void {
  const id = idFor(jobId, kind);
  if (rt.get(id)) return;
  const reference = method === "cash" ? cashReference(id) : speiDetails(id).concept;
  rt.spawn(id, "payment", paymentMachine, { kind, method, amount, dueAt, reference: null }, { jobId });
  rt.dispatch(id, { type: "CREATE_REFERENCE", reference });
  // Additional work has no fixed deadline: it must be paid before the job can be marked complete.
  if (dueAt) rt.scheduler.add(id, dueAt, { type: "DEADLINE_PASSED" }, `${kind} due`);
}
/** The simulated bank or store confirms the payment. */
export function confirmPayment(rt: DemoRuntime, jobId: string, kind: PayKind): void {
  if (rt.get(idFor(jobId, kind))) rt.dispatch(idFor(jobId, kind), { type: "PAYMENT_CONFIRMED" });
}
export const paymentState = (rt: DemoRuntime, jobId: string, kind: PayKind): string | undefined => rt.get(idFor(jobId, kind))?.snap.state;
