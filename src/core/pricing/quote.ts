import catalogJson from "../../seed/pricing/catalog.json";
import type { QuoteLine } from "../rules";
import { payoutFloor } from "../../config/revenue";
import { quoteTask, type Catalog, type TaskQuote, type UrgencyLevel } from "./instantQuote";

const catalog = catalogJson as unknown as Catalog;

/** Workbook category for each home-screen trade. */
const CATALOG_CATEGORY: Record<string, string> = {
  plumbing: "Plumbing", electrical: "Electrical", hvac: "HVAC", painting: "Painting",
  pest_control: "Pest", gardening: "Gardening", flooring: "Flooring", concrete: "Concrete",
  carpentry: "Carpentry", appliance: "Appliance", roofing: "Roofing", handyman: "Handyman",
  locksmith: "Locksmith", cleaning: "Cleaning"
};

/** The urgent checkbox uses the catalog's emergency labor rate. It is not a separate fee. */
const urgencyFor = (emergency: boolean): UrgencyLevel => (emergency ? "EMERGENCY" : "STANDARD");

const derivedRanges = new Map<string, [number, number]>();

function fixedQuotes(categoryId: string, urgency: UrgencyLevel): TaskQuote[] {
  const category = CATALOG_CATEGORY[categoryId];
  if (!category) return [];
  const quotes: TaskQuote[] = [];
  for (const task of Object.values(catalog.tasks)) {
    if (task.category !== category) continue;
    for (const tier of task.tiers) {
      const quote = quoteTask(catalog, { taskId: task.id, tier, urgency });
      if (quote.status === "FIXED") quotes.push(quote);
    }
  }
  return quotes;
}

function rangeFromCatalog(categoryId: string, urgency: UrgencyLevel): [number, number] | undefined {
  const cacheKey = `${categoryId}|${urgency}`;
  const cached = derivedRanges.get(cacheKey);
  if (cached) return cached;
  const totals = fixedQuotes(categoryId, urgency).map((quote) => quote.total);
  if (totals.length === 0) return undefined;
  const range: [number, number] = [Math.min(...totals), Math.max(...totals)];
  derivedRanges.set(cacheKey, range);
  return range;
}

/**
 * Lowest and highest fixed catalog total for a trade.
 * Urgent requests use the emergency labor rate inside those totals. There is no extra surcharge.
 */
export function estimateRange(categoryId: string, emergency: boolean) {
  const r = rangeFromCatalog(categoryId, urgencyFor(emergency));
  if (!r) throw new Error(`No estimate range configured for ${categoryId}`);
  return { low: r[0], high: r[1], surcharge: 0 };
}

const reviewByCategory = new Map<string, TaskQuote["humanReview"]>();

/**
 * Review reasons for a trade when no optional line is selected.
 * Base triggers and regulated labor count. As-needed lines (cleaning at height or mold, a gas connector) do not, until the homeowner selects them on that task.
 */
export function humanReviewForCategory(categoryId: string): TaskQuote["humanReview"] {
  const cached = reviewByCategory.get(categoryId);
  if (cached) return cached;
  const category = CATALOG_CATEGORY[categoryId];
  const seen = new Map<string, TaskQuote["humanReview"][number]>();
  if (category) {
    for (const task of Object.values(catalog.tasks)) {
      if (task.category !== category) continue;
      for (const tier of task.tiers) {
        const quote = quoteTask(catalog, { taskId: task.id, tier, urgency: "STANDARD" });
        for (const item of quote.humanReview) seen.set(`${item.kind}:${item.ref}`, item);
      }
    }
  }
  const list = [...seen.values()];
  reviewByCategory.set(categoryId, list);
  return list;
}

export interface BookedQuote {
  total: number;
  lines: QuoteLine[];
  /** Customer labor. The professional's payout is computed from this, not stored as a share of the total. */
  labor: number;
  /** Customer materials price (raw catalog cost with the materials rate applied once). */
  materials: number;
  /** Wage floor used for this quote: the catalog floor times the urgency multiplier. */
  wageFloor: number;
  /** Present only when the wage floor used is above labor after FIXX's share. */
  bookingFee: number;
  payout: number;
  taskId: string;
  tier: string;
}

/** Customer lines. The booking line is omitted when the amount is zero. */
export function customerLines(parts: { materials: number; labor: number; bookingFee: number }): QuoteLine[] {
  const lines: QuoteLine[] = [
    { id: "mat", amount: parts.materials },
    { id: "work", amount: parts.labor }
  ];
  if (parts.bookingFee > 0) lines.push({ id: "booking", amount: parts.bookingFee });
  return lines;
}

/**
 * Demo quote for a trade: one real catalog job near the middle of that trade's fixed totals.
 * Lines are materials, labor, and a booking fee when that fee is above zero. They add up to the customer total.
 */
export function buildQuote(categoryId: string, emergency: boolean): BookedQuote {
  const quotes = fixedQuotes(categoryId, urgencyFor(emergency));
  if (quotes.length === 0) throw new Error(`No estimate range configured for ${categoryId}`);
  const sorted = [...quotes].sort((a, b) => a.total - b.total || a.taskId.localeCompare(b.taskId) || a.tier.localeCompare(b.tier));
  const quote = sorted[Math.floor((sorted.length - 1) / 2)]!;
  const wageFloor = payoutFloor(quote.floor, quote.multiplier);
  return {
    total: quote.total,
    lines: customerLines({ materials: quote.materials, labor: quote.labor, bookingFee: quote.bookingFee }),
    labor: quote.labor,
    materials: quote.materials,
    wageFloor,
    bookingFee: quote.bookingFee,
    payout: quote.payout,
    taskId: quote.taskId,
    tier: quote.tier
  };
}
