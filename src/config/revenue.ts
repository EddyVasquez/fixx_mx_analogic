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
   * PLACEHOLDER (undecided): how money is rounded.
   * Conservative default: half-up to the centavo on each money amount.
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

/** Half-up to the configured number of decimals. The centavo is the default. */
export function roundMoney(amount: number, decimals: number = revenue.rounding.decimals): number {
  const factor = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

/**
 * Customer materials price. Pass the raw catalog cost, not a price that was already marked up.
 * raw × (1 + materialsMarkup) / (1 − cardFeePct × CARD_FEE_IVA), rounded once.
 */
export function materialsPrice(rawMaterialCost: number): number {
  const divisor = 1 - revenue.cardFeePct * CARD_FEE_IVA;
  return roundMoney(rawMaterialCost * (1 + revenue.materialsMarkup) / divisor);
}

/** FIXX's share of labor, before the wage floor. Not a customer charge. */
export function laborCommission(labor: number): number {
  return roundMoney(labor * revenue.proCommission);
}

/** Labor after FIXX's share, before the wage floor. */
export function laborAfterCommission(labor: number): number {
  return roundMoney(labor * (1 - revenue.proCommission));
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
export function proLaborPayout(labor: number, wageFloor: number): number {
  return roundMoney(Math.max(laborAfterCommission(labor), wageFloor));
}

/**
 * Amount added to the customer total when the wage floor used is above labor after FIXX's share.
 * Zero when the floor does not bind. Not a share of labor, and not shown as one.
 */
export function bookingFee(labor: number, wageFloor: number): number {
  const net = laborAfterCommission(labor);
  if (wageFloor <= net) return 0;
  return roundMoney(wageFloor - net);
}
