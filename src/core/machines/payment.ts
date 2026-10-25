import { notify, reject, type Effect, type MachineDef, type Outcome } from "./machine";
import type { PayMethod } from "../rules";

export type PaymentState = "pending" | "waitingReference" | "received" | "expired" | "refunded";
export type PaymentEvent =
  | { type: "CREATE_REFERENCE"; reference: string } | { type: "CARD_CHARGED" } | { type: "CARD_DECLINED" }
  | { type: "PAYMENT_CONFIRMED" } | { type: "DEADLINE_PASSED" } | { type: "REFUND_ISSUED" };
export interface PaymentCtx { kind: "deposit" | "balance" | "additional" | "full"; method: PayMethod; amount: number; dueAt: Date | null; reference: string | null }

const C = ["customer" as const];
const go = (t: PaymentState, fx: Effect[], ctx?: Partial<PaymentCtx>): Outcome<PaymentState, PaymentCtx> => ({ target: t, effects: fx, ...(ctx ? { ctx } : {}) });
const isCard = (m: PayMethod) => m === "card" || m === "wallet";

export const paymentMachine: MachineDef<PaymentState, PaymentEvent, PaymentCtx> = {
  id: "payment", initial: "pending",
  on: {
    pending: {
      CREATE_REFERENCE: (c, e) => isCard(c.method) ? reject("cards and wallets do not use a reference")
        : go("waitingReference", [notify("payment.referenceCreated", C, "urgent")], { reference: e.reference }),
      CARD_CHARGED: (c) => isCard(c.method) ? go("received", [notify("payment.received", C, "record")]) : reject("cash and SPEI are paid by reference"),
      CARD_DECLINED: () => go("pending", [notify("payment.declined", C, "urgent")])
    },
    waitingReference: {
      PAYMENT_CONFIRMED: () => go("received", [notify("payment.received", C, "record")]),
      DEADLINE_PASSED: (c, _e, now) => c.dueAt && now.getTime() >= c.dueAt.getTime()
        ? go("expired", [notify("payment.expired", C, "urgent")]) : reject("the deadline has not passed yet")
    },
    received: { REFUND_ISSUED: () => go("refunded", [notify("refund.issued", C, "record")]) }
  }
};
