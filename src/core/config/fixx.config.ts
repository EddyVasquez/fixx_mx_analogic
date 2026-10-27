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
    pest_control: 30, gardening: 30, flooring: 90, concrete: 90,
    carpentry: 90, appliance: 30, roofing: 90, handyman: 30, locksmith: 30, cleaning: 30
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

  /**
   * Customer check after the professional marks the job complete.
   * The balance (the 80% after the deposit) releases when the customer approves,
   * or on its own if nobody answers. Every number here is a labelled placeholder.
   */
  completionCheck: {
    // TODO(decision): hours with no answer before the balance releases on its own.
    autoReleaseHours: 48,
    autoReleaseLabel: "balance auto-release",
    // TODO(decision): reminders after the job is marked complete, in hours.
    reminders: [
      { id: "first", hours: 2, label: "first reminder" },
      { id: "second", hours: 24, label: "second reminder" },
      { id: "last", hours: 44, label: "last reminder" }
    ],
    // TODO(decision): hours the professional has to fix a reported problem on a return visit.
    returnVisitHours: 72,
    returnVisitLabel: "return visit",
    minBeforePhotos: 2,
    minAfterPhotos: 2,
    minProblemPhotos: 1,
    // TODO(decision): simulated photo location until a device provides one.
    demoLocation: "San Pedro Garza García, N.L.",
    coreItems: ["asQuoted", "areaClean", "noDamage"],
    /** Two or three checks per trade. The customer list is optional. */
    tradeItems: {
      plumbing: ["plumbing.noLeaks", "plumbing.drainsClear", "plumbing.shutoffsWork"],
      hvac: ["hvac.cools", "hvac.drainFlows", "hvac.filterSeated"],
      electrical: ["electrical.outletsWork", "electrical.fixturesWork", "electrical.panelClosed"],
      pest_control: ["pest_control.certificate", "pest_control.stationsPlaced", "pest_control.entryNoted"],
      painting: ["painting.coverageEven", "painting.edgesClean", "painting.noDrips"],
      gardening: ["gardening.debrisCleared", "gardening.plantsSet"],
      flooring: ["flooring.seamsFlat", "flooring.trimSet"],
      concrete: ["concrete.surfaceSet", "concrete.edgesFormed"],
      carpentry: ["carpentry.fitsSquare", "carpentry.hardwareTight"],
      appliance: ["appliance.powersOn", "appliance.cycleRuns"],
      roofing: ["roofing.leaksChecked", "roofing.debrisCleared"],
      handyman: ["handyman.taskDone", "handyman.areaCleared"],
      locksmith: ["locksmith.lockWorks", "locksmith.keysWork"],
      cleaning: ["cleaning.surfacesClean", "cleaning.suppliesRemoved"]
    } as Record<string, readonly string[]>,
    problemCategories: ["incomplete", "quality", "damage", "notAsQuoted"]
  },

  languages: ["en", "es", "ko"] as const,
  adminLanguages: ["en", "es"] as const,
  fallbackLanguage: "en" as const
};

export type Lang = (typeof config.languages)[number];
