/**
 * ALL undecided values live here. Every entry is a DEMO default, not a decision.
 * UI that shows one of these must render <DemoValue /> (marker) next to it.
 * Mirror each TODO in DECISIONS.md.
 */
export const DEMO = true as const;

export const config = {
  // TODO(decision): emergency surcharge amount.
  emergencySurchargeMXN: 300,
  // TODO(decision): travel fee bands (professional zone -> customer zone).
  travelFeeBandsMXN: { same: 80, adjacent: 150, far: 250 },
  // TODO(decision): professional price limits as +/- share of FIXX suggestion.
  professionalPriceLimitPct: 15,
  // TODO(decision): warranty period per category (days). Never hard-code "90 days" in UI.
  warrantyDaysByCategory: {
    plumbing: 60, electrical: 90, hvac: 60, painting: 30,
    pest_control: 30, gardening: 30, flooring: 90, concrete: 90
  } as Record<string, number>,
  // TODO(decision): business hours for human Agents (Mon-Sat).
  businessHours: { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" },
  // TODO(decision): sign-in code rules.
  signIn: { codeValiditySec: 600, resendSec: 30, lockoutSec: 900 },
  // TODO(decision): case review deadline, days after the decision.
  caseReviewDeadlineDays: 14,

  // Rules given in the brief (configurable, not hard-coded in logic):
  deposit: { sharePct: 20 },
  payment: {
    farJobHours: 48, nearJobHours: 24,
    depositDueHoursFar: 24, balanceDueHoursBefore: 24,
    fullDueHoursWithin24: 3
  },
  issueWindowHours: 24, issueReminderHoursBefore: 6,
  rescheduleResponseHours: 12,
  caseResolutionBusinessDays: 5,
  refundBusinessDays: 3,
  outOfAreaFollowUpHours: 24,
  timezone: "America/Monterrey",
  utcOffsetHours: -6, // Mexico has no DST since 2022; fixed offset keeps the rules engine dependency-free

  // TODO(decision): Mexican public holidays for business-day calc (seed 2026).
  holidays2026: ["2026-01-01", "2026-02-02", "2026-03-16", "2026-05-01", "2026-09-16", "2026-11-16", "2026-12-25"],

  // TODO(decision): FIXX estimate ranges per category (MXN). Painting a living room 3,500-5,000 is the brief's example.
  estimateRangesMXN: {
    plumbing: [800, 2500], electrical: [900, 3000], hvac: [1200, 4500], painting: [3500, 5000],
    pest_control: [700, 1800], gardening: [600, 2000], flooring: [4000, 12000], concrete: [6000, 20000]
  } as Record<string, [number, number]>,
  // TODO(decision G7): recommendation scoring weights and limits.
  matching: { sameZone: 30, nearby: 15, language: 25, qualityPerPoint: 0.3, topQualityScore: 90, maxRecommendations: 3 },
  // TODO(decision): offered time slots, in hours from now (demo).
  scheduleSlotHours: [30, 54, 78],
  // TODO(decision): professional's net share of a quote (demo). Never shown to customers.
  demoPayoutRatio: 0.8,
  // TODO(decision): time slots offered for urgent requests, in hours from now (demo).
  emergencySlotHours: [4, 8],
  // TODO(decision): demo sign-in code shown on screen (real codes go by SMS or WhatsApp).
  demoSignInCode: "123456",

  languages: ["en", "es", "ko"] as const,
  adminLanguages: ["en", "es"] as const,
  fallbackLanguage: "en" as const
};

export type Lang = (typeof config.languages)[number];
