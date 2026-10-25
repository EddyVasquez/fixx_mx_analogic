import { config } from "../config/fixx.config";
import { addBusinessDays, addDays, addHours } from "./time";

export const issueWindow = (completedAt: Date, cfg: typeof config = config) => ({
  endsAt: addHours(completedAt, cfg.issueWindowHours),
  reminderAt: addHours(completedAt, cfg.issueWindowHours - cfg.issueReminderHoursBefore)
});
export const rescheduleExpiry = (requestedAt: Date, cfg: typeof config = config): Date => addHours(requestedAt, cfg.rescheduleResponseHours);
export const caseResolutionDue = (reportedAt: Date, cfg: typeof config = config): Date => addBusinessDays(reportedAt, cfg.caseResolutionBusinessDays, cfg.holidays2026);
export const reviewDeadline = (decidedAt: Date, cfg: typeof config = config): Date => addDays(decidedAt, cfg.caseReviewDeadlineDays);
export const manualReviewFollowUp = (submittedAt: Date, cfg: typeof config = config): Date => addHours(submittedAt, cfg.outOfAreaFollowUpHours);

/** Warranty period comes from per-category config, never a hard-coded number. Starts at payment release (decision C5). */
export function warrantyEndsAt(startsAt: Date, categoryId: string, cfg: typeof config = config): Date {
  const days = cfg.warrantyDaysByCategory[categoryId];
  if (days === undefined) throw new Error(`No warranty configured for category: ${categoryId}`);
  return addDays(startsAt, days);
}
