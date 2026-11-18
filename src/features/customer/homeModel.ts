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
  plansVaryByPhase: z.boolean(),
  /** True when Eduardo has not sent measurements. Those plans are not used to price a quote. */
  todo: z.boolean().optional()
});
export type HomeModel = z.infer<typeof HomeModelSchema>;

/** The one measured plan. Counts match the Santa Sofía profile. */
export const SANTA_SOFIA_MODEL: HomeModel = {
  id: "santa-sofia",
  developer: "GP Vivienda",
  stories: 2,
  lotM2: 98,
  lotApproximate: true,
  builtM2: 100.49,
  garageCarsMin: 1,
  garageCarsMax: 2,
  livingDining: true,
  kitchen: true,
  kitchenBuiltIn: "optional",
  breakfastBar: "optional",
  groundFullBathrooms: 1,
  laundry: true,
  backPatio: true,
  sidePassage: true,
  bedrooms: 3,
  mainBedroomCloset: true,
  mainBedroomMinisplit: true,
  upperFullBathrooms: 1,
  minisplits: 1,
  plansVaryByPhase: true
};

/**
 * Two more plans. TODO: Eduardo has not sent their measurements.
 * `todo` keeps the placeholder square-meter figures out of quotes.
 */
const TODO_HOME_MODEL = (id: string): HomeModel => ({
  id,
  developer: "TODO",
  stories: 1,
  lotM2: 1,
  lotApproximate: true,
  builtM2: 1,
  garageCarsMin: 0,
  garageCarsMax: 0,
  livingDining: false,
  kitchen: false,
  kitchenBuiltIn: "none",
  breakfastBar: "none",
  groundFullBathrooms: 0,
  laundry: false,
  backPatio: false,
  sidePassage: false,
  bedrooms: 0,
  mainBedroomCloset: false,
  mainBedroomMinisplit: false,
  upperFullBathrooms: 0,
  minisplits: 0,
  plansVaryByPhase: false,
  todo: true
});

export const HOME_MODELS: readonly HomeModel[] = [
  SANTA_SOFIA_MODEL,
  TODO_HOME_MODEL("todo-model-2"),
  TODO_HOME_MODEL("todo-model-3")
];

export function homeModelById(id: string): HomeModel | undefined {
  return HOME_MODELS.find((model) => model.id === id);
}

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

/**
 * m² and minisplit count for a real home plan.
 * TODO plans return null so a placeholder square meter never becomes a price.
 */
export function measurementsFromHome(homeModelId: string): { cleaningTier: string; minisplits: number } | null {
  const model = homeModelById(homeModelId);
  if (!model || model.todo) return null;
  return {
    cleaningTier: matchingAreaTier(model.builtM2, cleaningAreaTiers()) ?? "",
    minisplits: model.minisplits
  };
}

/** Scope passed into the catalog quote. Bathroom and bedroom counts stay on the request; the catalog has no per-room rate. */
export function quoteScopeFromDraft(draft: HomeQuoteFacts & { selectedJobIds: readonly string[]; homeModelId?: string }): QuoteScope {
  return {
    ...(draft.homeModelId ? { homeModelId: draft.homeModelId } : {}),
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
