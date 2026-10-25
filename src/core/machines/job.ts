import {
  buildSchedule, planAdditionalWork, issueWindow, computeHeld, customerCancellation, refundDestination,
  type PayMethod, type QuoteLine, type CancelOutcome, type CancelStage
} from "../rules";
import { notify, reject, type Audience, type Effect, type MachineDef, type Outcome } from "./machine";

export type JobState =
  | "submitted" | "needsInfo" | "manualReview" | "estimated" | "recommendations" | "professionalSelected" | "quoteSent"
  | "awaitingDeposit" | "scheduled" | "onTheWay" | "checkedIn" | "inProgress" | "additionalWorkPending" | "checklistComplete"
  | "markedComplete" | "issueWindow" | "issueOpen" | "paymentReleased" | "rated"
  | "cancelled" | "professionalCancelled" | "noShow" | "rescheduleUnanswered" | "bookingExpired" | "refunded";

export type JobEvent =
  | { type: "NEEDS_INFO" } | { type: "INFO_PROVIDED" } | { type: "OUT_OF_AREA" }
  | { type: "MANUAL_REVIEW_APPROVED" } | { type: "MANUAL_REVIEW_DECLINED" }
  | { type: "ESTIMATE_READY" } | { type: "RECOMMENDATIONS_READY" }
  | { type: "SELECT_PROFESSIONAL"; professionalId: string } | { type: "PROFESSIONAL_DECLINES" }
  | { type: "SEND_QUOTE"; total: number; travelFee: number; payoutRatio: number; lines: QuoteLine[]; adjustmentReason?: string }
  | { type: "DECLINE_QUOTE" } | { type: "ACCEPT_QUOTE"; method: PayMethod; jobStart: Date }
  | { type: "PAYMENT_SATISFIED"; amount: number } | { type: "BOOKING_EXPIRED" } | { type: "BALANCE_OVERDUE" }
  | { type: "BALANCE_PAID" }
  | { type: "RESCHEDULE_ACCEPTED"; newStart: Date } | { type: "RESCHEDULE_DECLINED" } | { type: "RESCHEDULE_EXPIRED" }
  | { type: "ON_THE_WAY" } | { type: "CHECK_IN" } | { type: "START_WORK" }
  | { type: "REQUEST_ADDITIONAL_WORK"; amount: number } | { type: "APPROVE_ADDITIONAL_WORK" }
  | { type: "DECLINE_ADDITIONAL_WORK" } | { type: "ADDITIONAL_WORK_PAID" }
  | { type: "CHECKLIST_COMPLETE" } | { type: "MARK_COMPLETE" }
  | { type: "CUSTOMER_CANCELS" } | { type: "PRO_CANCELS" } | { type: "PRO_NO_SHOW" }
  | { type: "CHOOSE_REPLACEMENT" } | { type: "CHOOSE_REFUND" } | { type: "REFUND_ISSUED" }
  | { type: "ISSUE_REMINDER" } | { type: "REPORT_ISSUE"; selected: string[] | "wholeJob" }
  | { type: "WINDOW_CLOSED" } | { type: "CASE_RESOLVED" } | { type: "RATE" };

export interface JobCtx {
  method: PayMethod; total: number; jobStart: Date; professionalId: string | null;
  travelFee: number; payoutRatio: number; lines: QuoteLine[];
  paid: number; initialDue: number; balancePaid: boolean;
  onTheWayAt: Date | null; checklistDone: boolean;
  additional: { amount: number; status: "pending" | "approved" | "declined"; blocks: boolean; paid: boolean } | null;
  issueWindowEndsAt: Date | null; heldAmount: number; heldPayout: number;
  cancelledBy: "customer" | "professional" | "fixx" | null; refund: CancelOutcome | null; carryOver: number;
  adjustmentReason: string | null;
  /** When the payment deadlines were last (re)calculated from: acceptance, then any accepted reschedule. */
  scheduleBasis: Date | null;
}

export const newJobCtx = (p: Partial<JobCtx> = {}): JobCtx => ({
  method: "card", total: 0, jobStart: new Date(0), professionalId: null, travelFee: 0, payoutRatio: 0.8, lines: [],
  paid: 0, initialDue: 0, balancePaid: false, onTheWayAt: null, checklistDone: false, additional: null,
  issueWindowEndsAt: null, heldAmount: 0, heldPayout: 0, cancelledBy: null, refund: null, carryOver: 0, adjustmentReason: null, scheduleBasis: null, ...p
});

const C: Audience[] = ["customer"], P: Audience[] = ["professional"], CP: Audience[] = ["customer", "professional"];
const A: Audience[] = ["admin"], CPA: Audience[] = ["customer", "professional", "admin"];
type O = Outcome<JobState, JobCtx>;
const go = (target: JobState, effects: Effect[], ctx?: Partial<JobCtx>): O => ({ target, effects, ...(ctx ? { ctx } : {}) });

const customerCancel = (stage: CancelStage) => (c: JobCtx): O => {
  const r = customerCancellation({ stage, paid: c.paid, travelFee: c.travelFee });
  const fx: Effect[] = [notify("job.cancelledByCustomer", CP, "urgent", { travelFee: r.travelFeeCharged, refund: r.refund })];
  if (r.refund > 0) fx.push({ type: "createRefund", amount: r.refund, destination: refundDestination(c.method) });
  return go("cancelled", fx, { cancelledBy: "customer", refund: r });
};

const proCancel = (late: boolean) => (c: JobCtx): O => {
  const fx: Effect[] = [notify("job.cancelledByProfessional", CP, "urgent")];
  if (late) fx.push({ type: "qualityPenalty", professionalId: c.professionalId, reason: "lateCancellation" });
  return go("professionalCancelled", fx, { cancelledBy: "professional" });
};
const noShow = (c: JobCtx): O =>
  go("noShow", [notify("job.noShow", CPA, "urgent"), { type: "qualityPenalty", professionalId: c.professionalId, reason: "noShow" }], { cancelledBy: "professional" });

/** After a professional cancels, a no-show, or an unanswered reschedule the customer chooses. */
const choice = {
  CHOOSE_REPLACEMENT: (c: JobCtx): O =>
    go("recommendations", [notify("job.replacementChosen", C), { type: "recalculatePayments" }],
      { carryOver: c.paid, professionalId: null, onTheWayAt: null, checklistDone: false }),
  CHOOSE_REFUND: (c: JobCtx): O =>
    go("refunded", [notify("job.refundChosen", C, "record", { amount: c.paid }),
      ...(c.paid > 0 ? [{ type: "createRefund", amount: c.paid, destination: refundDestination(c.method) } as Effect] : [])])
};

const enterIssueWindow = (now: Date, fx: Effect[]): O => {
  const w = issueWindow(now);
  return go("issueWindow", [
    ...fx,
    { type: "timer", at: w.reminderAt, event: { type: "ISSUE_REMINDER" }, label: "issue window closes in 6 hours" },
    { type: "timer", at: w.endsAt, event: { type: "WINDOW_CLOSED" }, label: "issue window closes" }
  ], { issueWindowEndsAt: w.endsAt });
};
const release = (): Effect[] => [
  notify("job.paymentReleased", C, "record"), notify("payout.released", P, "urgent"),
  { type: "releasePayout" }, { type: "startWarranty" }
];

export const jobMachine: MachineDef<JobState, JobEvent, JobCtx> = {
  id: "job", initial: "submitted",
  on: {
    submitted: {
      NEEDS_INFO: () => go("needsInfo", [notify("request.needsInfo", C)]),
      OUT_OF_AREA: () => go("manualReview", [notify("request.manualReview", C, "urgent"), notify("admin.manualReview", A)]),
      ESTIMATE_READY: () => go("estimated", [notify("request.estimated", C)])
    },
    needsInfo: { INFO_PROVIDED: () => go("estimated", [notify("request.estimated", C)]) },
    manualReview: {
      MANUAL_REVIEW_APPROVED: () => go("estimated", [notify("request.estimated", C)]),
      MANUAL_REVIEW_DECLINED: () => go("cancelled", [notify("request.outOfArea", C, "record")], { cancelledBy: "fixx" })
    },
    estimated: { RECOMMENDATIONS_READY: () => go("recommendations", [notify("request.recommendations", C)]) },
    recommendations: {
      SELECT_PROFESSIONAL: (_c, e) => go("professionalSelected", [notify("job.requestForProfessional", P, "urgent")], { professionalId: e.professionalId })
    },
    professionalSelected: {
      SEND_QUOTE: (_c, e) => e.total > 0
        ? go("quoteSent", [notify("quote.sent", C, "urgent")], { total: e.total, travelFee: e.travelFee, payoutRatio: e.payoutRatio, lines: e.lines, adjustmentReason: e.adjustmentReason ?? null })
        : reject("quote total must be greater than 0"),
      PROFESSIONAL_DECLINES: () => go("recommendations", [notify("job.professionalDeclined", C)], { professionalId: null })
    },
    quoteSent: {
      ACCEPT_QUOTE: (c, e, now) => {
        const sch = buildSchedule({ method: e.method, total: c.total, jobStart: e.jobStart, now });
        const fx: Effect[] = [notify("quote.accepted", CP, "record"), { type: "recalculatePayments" }];
        sch.installments.forEach((i, idx) => {
          if (i.dueAt && i.onMissed) {
            fx.push({ type: "timer", at: i.dueAt, event: { type: idx === 0 ? "BOOKING_EXPIRED" : "BALANCE_OVERDUE" }, label: `${i.kind} due` });
          }
        });
        const initialDue = sch.installments[0]?.amount ?? 0;
        // After a replacement, a payment carried over from the previous professional may already cover the deposit.
        const covered = c.paid > 0 && c.paid >= initialDue;
        if (covered) fx.push(notify("job.scheduled", CP, "record"));
        return go(covered ? "scheduled" : "awaitingDeposit", fx,
          { method: e.method, jobStart: e.jobStart, initialDue, scheduleBasis: now, ...(covered ? { balancePaid: c.paid >= c.total } : {}) });
      },
      DECLINE_QUOTE: () => go("recommendations", [notify("quote.declined", P)], { professionalId: null })
    },
    awaitingDeposit: {
      PAYMENT_SATISFIED: (c, e) => {
        if (!(e.amount > 0)) return reject("payment amount must be greater than 0");
        const paid = c.paid + e.amount;
        return paid >= c.initialDue
          ? go("scheduled", [notify("job.scheduled", CP, "record")], { paid, balancePaid: paid >= c.total }) // a full prepayment (job within 24 hours) also settles the balance
          : go("awaitingDeposit", [notify("payment.partial", C)], { paid });
      },
      BOOKING_EXPIRED: () => go("bookingExpired", [notify("booking.expired", C, "urgent")]),
      CUSTOMER_CANCELS: customerCancel("beforeOnTheWay")
    },
    scheduled: {
      BALANCE_PAID: () => go("scheduled", [notify("payment.balanceReceived", C, "record")], { balancePaid: true }),
      BALANCE_OVERDUE: (c) => c.balancePaid ? reject("the balance is already paid") : go("cancelled", [notify("job.cancelledBalanceUnpaid", CP, "urgent"),
        ...(c.paid > 0 ? [{ type: "createRefund", amount: c.paid, destination: refundDestination(c.method) } as Effect] : [])],
        { cancelledBy: "fixx" }),
      RESCHEDULE_ACCEPTED: (_c, e, now) => e.newStart.getTime() > now.getTime()
        ? go("scheduled", [notify("reschedule.accepted", CP, "urgent"), { type: "recalculatePayments" }], { jobStart: e.newStart, scheduleBasis: now })
        : reject("new time must be in the future"),
      RESCHEDULE_DECLINED: () => go("scheduled", [notify("reschedule.declined", C, "urgent")]),
      RESCHEDULE_EXPIRED: () => go("rescheduleUnanswered", [notify("reschedule.expired", C, "urgent")]),
      ON_THE_WAY: (_c, _e, now) => go("onTheWay", [notify("job.onTheWay", C, "urgent")], { onTheWayAt: now }),
      CUSTOMER_CANCELS: customerCancel("beforeOnTheWay"),
      PRO_CANCELS: proCancel(false),
      PRO_NO_SHOW: noShow
    },
    onTheWay: {
      CHECK_IN: () => go("checkedIn", [notify("job.checkedIn", C, "urgent")]),
      CUSTOMER_CANCELS: customerCancel("afterOnTheWay"),
      PRO_CANCELS: proCancel(true),
      PRO_NO_SHOW: noShow
    },
    checkedIn: { START_WORK: () => go("inProgress", [notify("job.started", C)]) },
    inProgress: {
      REQUEST_ADDITIONAL_WORK: (_c, e) => e.amount > 0
        ? go("additionalWorkPending", [notify("additionalWork.requested", C, "urgent", { amount: e.amount })],
          { additional: { amount: e.amount, status: "pending", blocks: false, paid: false } })
        : reject("additional work amount must be greater than 0"),
      ADDITIONAL_WORK_PAID: (c) => go("inProgress", [notify("payment.additionalReceived", CP, "record")],
        { additional: c.additional ? { ...c.additional, paid: true } : null }),
      CHECKLIST_COMPLETE: () => go("checklistComplete", [notify("job.checklistComplete", C)], { checklistDone: true })
    },
    additionalWorkPending: {
      APPROVE_ADDITIONAL_WORK: (c) => {
        if (!c.additional) return reject("no additional work to approve");
        const plan = planAdditionalWork(c.method, c.additional.amount);
        return go("inProgress", [notify("additionalWork.approved", CP, "urgent", { amount: plan.amount })],
          { total: c.total + plan.amount, lines: [...c.lines, { id: "additional", amount: plan.amount }], additional: { ...c.additional, status: "approved", blocks: plan.blocksCompletion, paid: !plan.blocksCompletion } });
      },
      DECLINE_ADDITIONAL_WORK: (c) => go("inProgress", [notify("additionalWork.declined", P)],
        { additional: c.additional ? { ...c.additional, status: "declined" } : null })
    },
    checklistComplete: {
      ADDITIONAL_WORK_PAID: (c) => go("checklistComplete", [notify("payment.additionalReceived", CP, "record")],
        { additional: c.additional ? { ...c.additional, paid: true } : null }),
      MARK_COMPLETE: (c, _e, now) => {
        if (!c.checklistDone) return reject("complete the checklist first");
        if (c.additional?.status === "approved" && c.additional.blocks && !c.additional.paid) {
          return reject("the additional work must be paid before the job can be marked complete");
        }
        return c.balancePaid
          ? enterIssueWindow(now, [notify("job.complete", C, "urgent")])
          : go("markedComplete", [notify("job.completeBalanceDue", C, "urgent")]);
      }
    },
    markedComplete: { BALANCE_PAID: (_c, _e, now) => enterIssueWindow(now, [notify("payment.balanceReceived", C, "record")]) },
    issueWindow: {
      ISSUE_REMINDER: () => go("issueWindow", [notify("issueWindow.reminder", C, "urgent")]),
      REPORT_ISSUE: (c, e, now) => {
        if (c.issueWindowEndsAt && now.getTime() > c.issueWindowEndsAt.getTime()) return reject("the issue window has closed");
        const h = computeHeld({ lines: c.lines, selected: e.selected, jobTotal: c.total, payoutRatio: c.payoutRatio });
        return go("issueOpen", [notify("issue.reported", CPA, "urgent", { held: h.held, heldPayout: h.heldPayout }),
          { type: "createCase", heldAmount: h.held, heldPayout: h.heldPayout, wholeJob: h.wholeJob }],
          { heldAmount: h.held, heldPayout: h.heldPayout });
      },
      WINDOW_CLOSED: (c, _e, now) => c.issueWindowEndsAt && now.getTime() < c.issueWindowEndsAt.getTime()
        ? reject("the issue window is still open") : go("paymentReleased", release())
    },
    issueOpen: { CASE_RESOLVED: () => go("paymentReleased", release()) },
    paymentReleased: { RATE: () => go("rated", [notify("job.rated", P)]) },
    cancelled: { REFUND_ISSUED: () => go("refunded", [notify("refund.issued", C, "record")]) },
    professionalCancelled: choice,
    noShow: choice,
    rescheduleUnanswered: choice
  }
};

/** The UI warns professionals before a cancellation that lowers their Quality Score. */
export const cancelLowersQualityScore = (state: JobState): boolean => state === "onTheWay";
