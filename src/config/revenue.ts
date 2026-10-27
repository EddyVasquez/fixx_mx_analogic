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
   * Confirmed: half-up to the centavo on every money amount.
   * Labor is rounded after urgency, and only then split.
   */
  rounding: {
    decimals: 2,
    mode: "half-up" as const
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
 * Half-up to the centavo, computed in integer minor units.
 * A 1e-8 bias lifts binary values that land just under an exact half
 * (1.005 × 100 is 100.49999999999999; 534.285 must become 534.29).
 */
export function roundHalfUp(amount: number, decimals: number = revenue.rounding.decimals): number {
  if (!Number.isFinite(amount)) return amount;
  const sign = amount < 0 ? -1 : 1;
  const factor = 10 ** decimals;
  const minor = Math.floor(Math.abs(amount) * factor + 1e-8 + 0.5);
  return (sign * minor) / factor;
}

/** Half-up to the configured number of decimals. The centavo is the default. */
export const roundMoney = roundHalfUp;

function toMinor(amount: number): number {
  return Math.round(roundHalfUp(amount) * 100);
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
 * Customer labor is roundHalfUp of this. The professional's share is roundHalfUp of this times (1 − proCommission).
 * Rounding the customer labor first, then multiplying again, would move a fraction of a centavo twice.
 */
export function proShare(laborAfterUrgency: number): number {
  return roundHalfUp(laborAfterUrgency * (1 - revenue.proCommission));
}

/** Customer labor: half-up to the centavo after urgency, before the split. */
export function customerLabor(laborAfterUrgency: number): number {
  return roundHalfUp(laborAfterUrgency);
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
  return Math.max(toMinor(proShare(laborAfterUrgency)), toMinor(roundHalfUp(wageFloor))) / 100;
}

/**
 * roundHalfUp(effective floor) − proShare, and never below zero.
 * `wageFloor` is the floor used (already scaled by urgency when that rule applies).
 * Not a share of labor, and not shown as one.
 */
export function bookingFee(laborAfterUrgency: number, wageFloor: number): number {
  const fee = toMinor(roundHalfUp(wageFloor)) - toMinor(proShare(laborAfterUrgency));
  return fee > 0 ? fee / 100 : 0;
}
