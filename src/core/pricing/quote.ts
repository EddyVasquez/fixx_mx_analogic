import catalogJson from "../../seed/pricing/catalog.json";
import { config } from "../config/fixx.config";
import type { QuoteLine } from "../rules";
import { quoteTask, type Catalog } from "./instantQuote";

const round10 = (n: number) => Math.round(n / 10) * 10;
const catalog = catalogJson as unknown as Catalog;

/** Workbook category for each home-screen trade. The price range is the lowest and highest fixed standard total in that category. */
const CATALOG_CATEGORY: Record<string, string> = {
  plumbing: "Plumbing", electrical: "Electrical", hvac: "HVAC", painting: "Painting",
  pest_control: "Pest", gardening: "Gardening", flooring: "Flooring", concrete: "Concrete",
  carpentry: "Carpentry", appliance: "Appliance", roofing: "Roofing", handyman: "Handyman",
  locksmith: "Locksmith", cleaning: "Cleaning"
};

const derivedRanges = new Map<string, [number, number]>();

function rangeFromCatalog(categoryId: string): [number, number] | undefined {
  const cached = derivedRanges.get(categoryId);
  if (cached) return cached;
  const category = CATALOG_CATEGORY[categoryId];
  if (!category) return undefined;
  const totals: number[] = [];
  for (const task of Object.values(catalog.tasks)) {
    if (task.category !== category) continue;
    for (const tier of task.tiers) {
      const quote = quoteTask(catalog, { taskId: task.id, tier, urgency: "STANDARD" });
      if (quote.status === "FIXED") totals.push(quote.total);
    }
  }
  if (totals.length === 0) return undefined;
  const range: [number, number] = [Math.min(...totals), Math.max(...totals)];
  derivedRanges.set(categoryId, range);
  return range;
}

/** FIXX estimate range for a category, taken from the pricing workbook. The surcharge is shown separately, before the customer confirms. */
export function estimateRange(categoryId: string, emergency: boolean, cfg: typeof config = config) {
  const r = rangeFromCatalog(categoryId);
  if (!r) throw new Error(`No estimate range configured for ${categoryId}`);
  return { low: r[0], high: r[1], surcharge: emergency ? cfg.emergencySurchargeMXN : 0 };
}

/** Demo quote: the midpoint of the range, split into generic lines that always add up to the total. */
export function buildQuote(categoryId: string, emergency: boolean, cfg: typeof config = config): { total: number; lines: QuoteLine[] } {
  const { low, high, surcharge } = estimateRange(categoryId, emergency, cfg);
  const base = round10((low + high) / 2);
  const prep = round10(base * 0.15), mat = round10(base * 0.35);
  const lines: QuoteLine[] = [{ id: "prep", amount: prep }, { id: "mat", amount: mat }, { id: "work", amount: base - prep - mat }];
  if (surcharge > 0) lines.push({ id: "urgent", amount: surcharge });
  return { total: base + surcharge, lines };
}
