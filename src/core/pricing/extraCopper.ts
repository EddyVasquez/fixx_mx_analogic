/**
 * Extra copper metres on a minisplit install (FIXX-HVC-001) only.
 * The base job already includes a 10 ft (3.05 m) kit. The professional enters
 * metres beyond that kit. 1 t and 1.5 t use HVC-M16. 2 t and 3 t use HVC-M17.
 * The customer price is the same materials price as every other material:
 * one markup and one card-fee gross-up. It is not derived from a payout ratio.
 */
import catalogJson from "../../seed/pricing/catalog.json";
import { materialsPrice } from "../../config/revenue";
import type { Catalog } from "./instantQuote";

const catalog = catalogJson as unknown as Catalog;

export const MINISPLIT_TASK = "FIXX-HVC-001";
/** Quote line id. Labels live in quote.line.extraCopper. */
export const EXTRA_COPPER_LINE = "extraCopper";

const ITEM_BY_TIER: Record<string, "HVC-M16" | "HVC-M17"> = {
  "1 t": "HVC-M16",
  "1.5 t": "HVC-M16",
  "2 t": "HVC-M17",
  "3 t": "HVC-M17"
};

export function extraCopperItemId(tier: string): "HVC-M16" | "HVC-M17" | null {
  return ITEM_BY_TIER[tier] ?? null;
}

/**
 * Customer price for `meters` beyond the included kit.
 * Returns null unless this is a minisplit install, the tier has a copper line, and meters is greater than zero.
 */
export function extraCopperPrice(taskId: string, tier: string, meters: number, cat: Catalog = catalog): number | null {
  if (taskId !== MINISPLIT_TASK) return null;
  if (!(meters > 0) || !Number.isFinite(meters)) return null;
  const itemId = extraCopperItemId(tier);
  if (!itemId) return null;
  const unit = cat.items[itemId]?.price;
  if (unit == null) return null;
  return materialsPrice(unit * meters);
}
