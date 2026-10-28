import { z } from "zod";
import catalogJson from "@/seed/pricing/catalog.json";
import { matchingAreaTier } from "@/core/pricing/areaTier";
import type { QuoteScope } from "@/core/pricing/quote";

const feature = z.enum(["included", "optional", "none"]);

/** One builder floor plan. Quote counts are derived from it; the customer can still change them per request. */
export const HomeModelSchema = z.object({
  id: z.string().min(1),
  developer: z.string().min(1),
  stories: z.number().int().positive(),
  lotM2: z.number().positive(),
  lotApproximate: z.boolean(),
  builtM2: z.number().positive(),
  garageCarsMin: z.number().int().nonnegative(),
  garageCarsMax: z.number().int().nonnegative(),
  livingDining: z.boolean(),
  kitchen: z.boolean(),
  kitchenBuiltIn: feature,
  breakfastBar: feature,
  groundFullBathrooms: z.number().int().nonnegative(),
  laundry: z.boolean(),
  backPatio: z.boolean(),
  sidePassage: z.boolean(),
  bedrooms: z.number().int().nonnegative(),
  mainBedroomCloset: z.boolean(),
  mainBedroomMinisplit: z.boolean(),
  upperFullBathrooms: z.number().int().nonnegative(),
  minisplits: z.number().int().nonnegative(),
  plansVaryByPhase: z.boolean()
});
export type HomeModel = z.infer<typeof HomeModelSchema>;

interface TaskTiers { tiers?: string[] }
const catalogTasks = (catalogJson as { tasks: Record<string, TaskTiers> }).tasks;

/** Area bands on standard home cleaning. The other size-tiered cleaning jobs use the same bands. */
export function cleaningAreaTiers(): string[] {
  return catalogTasks["FIXX-CLN-001"]?.tiers ?? [];
}

export interface HomeQuoteFacts {
  cleaningTier: string;
  minisplits: number;
  bathrooms: number;
  bedrooms: number;
}

/** Counts a request starts with. Cleaning uses the catalog band for the built area, not the lot. */
export function quoteFactsFromModel(model: HomeModel): HomeQuoteFacts {
  return {
    cleaningTier: matchingAreaTier(model.builtM2, cleaningAreaTiers()) ?? "",
    minisplits: model.minisplits,
    bathrooms: model.groundFullBathrooms + model.upperFullBathrooms,
    bedrooms: model.bedrooms
  };
}

export const blankQuoteFacts = (): HomeQuoteFacts => ({
  cleaningTier: "",
  minisplits: 1,
  bathrooms: 0,
  bedrooms: 0
});

/** Scope passed into the catalog quote. Bathroom and bedroom counts stay on the request; the catalog has no per-room rate. */
export function quoteScopeFromDraft(draft: HomeQuoteFacts & { selectedJobIds: readonly string[] }): QuoteScope {
  return {
    ...(draft.selectedJobIds.length > 0 ? { taskIds: draft.selectedJobIds } : {}),
    ...(draft.cleaningTier ? { cleaningTier: draft.cleaningTier } : {}),
    minisplits: draft.minisplits
  };
}

/** Areas stay in one written form in every language, the same way money keeps its centavos. */
export function formatArea(m2: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(m2) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(m2);
}
