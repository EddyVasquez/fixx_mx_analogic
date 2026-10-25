/** Main-path statuses shown in the status bar. Branch states (cancelled, noShow...) arrive with the machines in step 4. */
export const JOB_STATUS_ORDER = [
  "requestSubmitted", "estimated", "professionalSelected", "quoteSent", "quoteAccepted", "scheduled",
  "onTheWay", "inProgress", "markedComplete", "issueWindow", "paymentReleased", "rated"
] as const;
export type JobStatus = (typeof JOB_STATUS_ORDER)[number];
