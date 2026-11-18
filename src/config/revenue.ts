/**
 * The only place a catalog cost becomes a customer price or a professional payout.
 *
 * catalog.json stores raw labor and raw material cost. Do not multiply by these
 * rates anywhere else, and do not multiply a catalog price by 1.16. Material
 * prices in the workbook already include their own IVA.
 *
 * Customer total = materials price + labor + booking fee.
 * Materials price = raw × (1 + materialsMarkup) / (1 − cardFeePct × CARD_FEE_IVA).
 * FIXX keeps proCommission × labor. That share is taken out of labor. It is never
 * a customer line and never named in the customer interface.
 * The booking fee is only the shortfall when the wage floor used is higher than
 * labor after that share. It is zero otherwise. There is no minimum share.
 */
export const revenue = {
  /** Added to raw material cost before the card-fee gross-up. */
  materialsMarkup: 0.05,
  /** Share of labor kept by FIXX, taken out of the professional's labor. */
  proCommission: 0.15,

  /**
   * PLACEHOLDER (confirm with the payment processor): card processing fee.
   * It is inside the materials price, not a separate customer line.
   */
  cardFeePct: 0.036,

  /**
   * The wage floor used for payout and for the booking-fee shortfall.
   * Decided: floor used = base floor × urgency multiplier.
   */
  floorScalesWithUrgency: true,

  /**
   * Confirmed: round up to the next centavo on every money amount.
   * Same rule as the workbook: ROUNDUP(ROUND(x, 6), 2).
   * Labor is rounded after urgency, and only then split.
   */
  rounding: {
    decimals: 2,
    mode: "round-up" as const
  },

  /**
   * PLACEHOLDER (undecided): cancellation before and after the professional is on the way.
   * Conservative default: refund everything paid before they are on the way.
   * After that, keep the travel fee aside and refund the rest.
   * Who receives the travel fee is not decided, so this placeholder does not pay it to the professional.
   */
  cancellation: {
    refundAllBeforeOnTheWay: true,
    deductTravelFeeAfterOnTheWay: true,
    travelFeeToProfessional: false
  },

  /**
   * PLACEHOLDER (undecided): when money held for a job may be released.
   * Conservative default: do not release until the customer confirms the job is done.
   * This does not move money. A later change stores the labor payout and wires the confirm action.
   */
  release: {
    requiresCustomerConfirm: true,
    autoReleaseHours: null as number | null
  },

  /**
   * PLACEHOLDER (undecided): cash and SPEI cannot be captured the way a card can.
   * Conservative default: they are not eligible for an up-front hold.
   * Deadline rules stay in fixx.config until this is decided.
   */
  cashAndSpei: {
    eligibleForHold: false
  }
} as const;

/** IVA on the card fee only. 16% as a multiplier (fee × 1.16). Catalog material prices already include their own IVA. */
export const CARD_FEE_IVA = 1.16;

/**
 * Workbook money round, used for every price: ROUNDUP(ROUND(amount, 6), 2).
 * The 6-decimal round drops binary noise so an exact centavo such as 887.50 stays 887.50.
 * Anything past that centavo rounds up, away from zero. 1234.561 becomes 1234.57.
 */
export function roundUpToCentavo(amount: number): number {
  if (!Number.isFinite(amount) || amount === 0) return amount;
  const sign = amount < 0 ? -1 : 1;
  const [whole = "0", frac = ""] = Math.abs(amount).toFixed(10).split(".");
  const digits = frac.padEnd(10, "0");
  let micro = BigInt(whole) * 1_000_000n + BigInt(digits.slice(0, 6));
  if (digits[6]! >= "5") micro += 1n;
  const pastCentavo = micro % 10_000n;
  if (pastCentavo !== 0n) micro += 10_000n - pastCentavo;
  return (sign * Number(micro / 10_000n)) / 100;
}

/** Round up to the next centavo. Every catalog price, fee, total, and deposit uses this. */
export const roundMoney = roundUpToCentavo;

function toMinor(amount: number): number {
  return Math.round(roundUpToCentavo(amount) * 100);
}

/**
 * Customer materials price. Pass the raw catalog cost, not a price that was already marked up.
 * raw × (1 + materialsMarkup) / (1 − cardFeePct × CARD_FEE_IVA), rounded once.
 */
export function materialsPrice(rawMaterialCost: number): number {
  const divisor = 1 - revenue.cardFeePct * CARD_FEE_IVA;
  return roundMoney(rawMaterialCost * (1 + revenue.materialsMarkup) / divisor);
}

/**
 * Urgency-applied labor before the customer centavo round.
 * Customer labor is roundUpToCentavo of this, before the split.
 * The professional's share is roundUpToCentavo of that already rounded labor times (1 − proCommission).
 */
export function proShare(laborAfterUrgency: number): number {
  return roundUpToCentavo(customerLabor(laborAfterUrgency) * (1 - revenue.proCommission));
}

/** Customer labor: round up to the centavo after urgency, before the split. */
export function customerLabor(laborAfterUrgency: number): number {
  return roundUpToCentavo(laborAfterUrgency);
}

/**
 * FIXX's share of the customer labor line. It is the remainder after proShare,
 * so the two parts add up to the rounded labor. It is not round(labor × proCommission).
 */
export function laborCommission(laborAfterUrgency: number): number {
  return (toMinor(customerLabor(laborAfterUrgency)) - toMinor(proShare(laborAfterUrgency))) / 100;
}

/** Labor after FIXX's share, before the wage floor. */
export function laborAfterCommission(laborAfterUrgency: number): number {
  return proShare(laborAfterUrgency);
}

/**
 * Per-trade wage floor for a visit.
 * `dailyFloor` is one day's minimum from the workbook (cleaning is 342.47).
 * A visit always counts at least one day, and a partial extra day counts as a full day.
 */
export function wageFloorForDays(dailyFloor: number, visitDays: number): number {
  const days = Math.max(1, Math.ceil(visitDays - 1e-9));
  return roundMoney(dailyFloor * days);
}

/**
 * Wage floor used for payout and for the booking-fee shortfall.
 * Decided default: base floor × urgency multiplier. `wageFloor` is the base floor.
 */
export function payoutFloor(
  wageFloor: number,
  urgencyMultiplier: number,
  scales: boolean = revenue.floorScalesWithUrgency
): number {
  return scales ? roundMoney(wageFloor * urgencyMultiplier) : wageFloor;
}

/**
 * What the professional is owed for labor.
 * FIXX's share comes out of labor. The wage floor wins when that would pay less than the floor.
 * `wageFloor` must already be the floor used (see payoutFloor).
 * Pure function: storing and releasing this amount is a later change.
 */
export function proLaborPayout(laborAfterUrgency: number, wageFloor: number): number {
  return Math.max(toMinor(proShare(laborAfterUrgency)), toMinor(roundUpToCentavo(wageFloor))) / 100;
}

/**
 * roundUpToCentavo(effective floor) − proShare, and never below zero.
 * `wageFloor` is the floor used (already scaled by urgency when that rule applies).
 * Not a share of labor, and not shown as one.
 */
export function bookingFee(laborAfterUrgency: number, wageFloor: number): number {
  const fee = toMinor(roundUpToCentavo(wageFloor)) - toMinor(proShare(laborAfterUrgency));
  return fee > 0 ? fee / 100 : 0;
}
