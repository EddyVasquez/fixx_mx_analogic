import type { JobStatus } from "../types/jobStatus";
import type { JobState } from "./job";

const MAP: Partial<Record<JobState, JobStatus>> = {
  submitted: "requestSubmitted", needsInfo: "requestSubmitted", manualReview: "requestSubmitted",
  estimated: "estimated", recommendations: "estimated", professionalSelected: "professionalSelected", quoteSent: "quoteSent",
  awaitingDeposit: "quoteAccepted", scheduled: "scheduled", onTheWay: "onTheWay", checkedIn: "inProgress", inProgress: "inProgress",
  additionalWorkPending: "inProgress", checklistComplete: "inProgress", markedComplete: "markedComplete",
  issueWindow: "issueWindow", issueOpen: "issueWindow", paymentReleased: "paymentReleased", rated: "rated"
};
/** Main-path status for the status bar; null for branch states (cancelled, no-show, refunded...), which get their own label. */
export const statusFor = (s: JobState): JobStatus | null => MAP[s] ?? null;
