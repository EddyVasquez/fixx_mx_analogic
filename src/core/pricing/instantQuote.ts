/**
 * Instant upfront quotes, built from the FIXX pricing catalog (see docs/FIXX_instant_quote_spec.md).
 * Pure functions: the catalog is passed in, so tests and the app use the same code.
 * All amounts are MXN with IVA included. Urgency multiplies labor only.
 */
export type UrgencyLevel = "STANDARD" | "MEDIUM" | "HIGH" | "EMERGENCY";
export type UiUrgency = "standard" | "medium" | "high";

export interface CatalogItem { id: string; category: string; name: string; spanish: string | null; spec: string | null; unit: string | null; store: string | null; price: number | null; iva: string | null; checkDate: string | null; flag: string; homeownerChoice?: boolean }
export type ReviewTrigger = "base" | "as-needed" | "none";
export interface CatalogLine { id: string; tier: string; itemId: string; qty: number; basis: string; unitPrice: number | null; type: "base" | "as-needed" | "flagged" | "reference"; flag: string; reviewTrigger?: ReviewTrigger }
export interface CatalogTask { id: string; category: string; job: string; jobEs?: string; jobKo?: string; tiers: string[]; lines: CatalogLine[] }
export interface CatalogLabor {
  key: string; taskId: string; tierScope: string; trade: string; basis: string; rateLow: number | null; rateTypical: number | null; rateHigh: number | null;
  refQty: number | null; typicalRef: number | null; confidence: string; flag: string; checkedDate: string | null; estJobDays: number | null; dailyMin: number | null; floor: number | null;
}
export interface Catalog {
  version: string; tasks: Record<string, CatalogTask>; items: Record<string, CatalogItem>; labor: Record<string, CatalogLabor>;
  dailyMin: Record<string, number>; urgency: { level: UrgencyLevel; multiplier: number; uiLevel: string; uiOption: string }[];
  diagnosis: { trade: string; low: number | null; typical: number | null; high: number | null; flag: string | null }[]; taskIdMap: Record<string, string>;
}

export interface QuoteInput {
  taskId: string; tier: string; urgency: UrgencyLevel;
  /** m², tonnage, points, doors...; defaults to the catalog's reference scope. */
  scopeQty?: number;
  /** Line ids of the as-needed items the homeowner (or pro) ticked. */
  asNeededLineIds?: string[];
  /** Add the diagnosis/visit fee (only when the scope cannot be set up front). */
  withDiagnosis?: boolean;
}
export interface LineOut { lineId: string; itemId: string; item: string; qty: number; unitPrice: number | null; cost: number | null; basis: string; flag: string; exclusiveGroup?: string }
export type QuoteStatus = "FIXED" | "QUOTE_ON_SITE" | "BLOCKED_STALE_PRICE";
export interface TaskQuote {
  catalogVersion: string; taskId: string; tier: string; urgency: UrgencyLevel; multiplier: number; status: QuoteStatus; reasons: string[];
  scale: number; estJobDays: number; trade: string; laborKey: string; laborFlag: string;
  materials: number; marketLabor: number; floor: number; laborBasis: number; labor: number; payout: number;
  asNeeded: { options: LineOut[]; selected: LineOut[]; selectedTotal: number };
  /** Never priced into the total and never purchased automatically. */
  pendingReview: LineOut[];
  /** Fixtures, appliances, minisplit units, floor covering: shown as a range, excluded from the total. */
  homeownerChoice: LineOut[]; homeownerChoiceRange: { min: number; max: number } | null;
  /** Lines without a price: "priced on site". */
  unpriced: LineOut[];
  humanReview: { kind: "line" | "labor"; ref: string; reason: string }[];
  /** True when a regulated labor line, or a selected regulated add-on, blocks booking until a person approves. */
  needsHumanReview: boolean;
  warnings: string[];
  diagnosisFee: number | null;
  /** Exact total; round only for display. */
  total: number; displayTotal: number;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
/** Half up to a whole peso. Customer-facing prices use round2 so centavos stay visible. */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

/** UI shows Standard / Medium / High; Emergency is a toggle inside High. Always send the four-value level to pricing. */
export function toUrgencyLevel(ui: UiUrgency, emergencyToggle: boolean): UrgencyLevel {
  if (ui === "standard") return "STANDARD";
  if (ui === "medium") return "MEDIUM";
  return emergencyToggle ? "EMERGENCY" : "HIGH";
}
export function multiplierFor(cat: Catalog, level: UrgencyLevel): number {
  const u = cat.urgency.find((x) => x.level === level);
  if (!u) throw new Error(`Unknown urgency level: ${level}`);
  return u.multiplier;
}
/** Old task ids are accepted as aliases (Task_ID_Map). */
export const resolveTaskId = (cat: Catalog, id: string): string => (cat.tasks[id] ? id : cat.taskIdMap[id] ?? id);
/** Task|Tier first, then Task|All (same lookup as Quote_Builder column G). */
export function laborKeyFor(cat: Catalog, taskId: string, tier: string): string {
  return cat.labor[`${taskId}|${tier}`] ? `${taskId}|${tier}` : `${taskId}|All`;
}

export type Freshness = "fresh" | "stale" | "blocked" | "unknown";
/** Up to 7 days is fresh; 8 to 30 days still quotes with a warning; after 30 days the task is blocked until refreshed. */
export function priceFreshness(checkDate: string | null, now: Date): Freshness {
  if (!checkDate) return "unknown";
  const days = Math.floor((now.getTime() - Date.parse(`${checkDate}T00:00:00Z`)) / 86_400_000);
  return days <= 7 ? "fresh" : days <= 30 ? "stale" : "blocked";
}

const PENDING_FLAGS = new Set(["FLAGGED-human review", "REFERENCE ONLY-COFEPRIS", "structural"]);
/** Reference and flagged lines stay out of the homeowner-choice range. Review itself follows Review_Trigger. */
const heldOutOfChoice = (l: CatalogLine) => l.type === "flagged" || PENDING_FLAGS.has(l.flag);
const isChoice = (l: CatalogLine) => l.type === "reference" && !heldOutOfChoice(l);
/** Base triggers review immediately. As-needed triggers only when the homeowner selects that line. */
function triggersReview(l: CatalogLine, selectedIds: ReadonlySet<string>): boolean {
  if (l.type === "reference") return false;
  if (l.reviewTrigger === "base") return true;
  if (l.reviewTrigger === "as-needed") return selectedIds.has(l.id);
  return false;
}
/** Add-on labor from Labor_Rates (for example oven, fridge, balcony, pet stain). The visit wage floor is not applied again. */
function addonLaborAmount(cat: Catalog, taskId: string, basis: string): number {
  const haystack = basis.toLowerCase();
  for (const lab of Object.values(cat.labor)) {
    if (lab.taskId !== taskId || !/^add-on\b/i.test(lab.tierScope)) continue;
    const tokens = lab.tierScope.replace(/^add-on\s*/i, "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
    if (tokens.length > 0 && tokens.every((t) => haystack.includes(t))) {
      if (lab.typicalRef != null) return lab.typicalRef;
      if (lab.rateTypical != null && lab.refQty != null) return lab.rateTypical * lab.refQty;
    }
  }
  return 0;
}
/** A fractional catalog quantity is already a share of a pack, so it scales linearly. Whole packs round up. */
const isProrated = (l: CatalogLine) => !Number.isInteger(l.qty) || /line total|prorated|per m/i.test(l.basis);
const scaledQty = (l: CatalogLine, scale: number) => (isProrated(l) ? l.qty * scale : scale === 1 ? l.qty : Math.ceil(l.qty * scale - 1e-9));

/** Covering the homeowner buys separately. The workbook keeps these off the task lines and out of the total. */
function choiceItems(cat: Catalog, task: CatalogTask): CatalogItem[] {
  const pool = Object.values(cat.items).filter((i) => i.homeownerChoice && i.category === task.category);
  const job = task.job.toLowerCase();
  const tile = pool.filter((i) => /tile/i.test(i.name));
  const floating = pool.filter((i) => /laminate|spc/i.test(i.name));
  if (/tile/.test(job) && tile.length) return tile;
  if (/floating|laminate|spc/.test(job) && floating.length) return floating;
  return [];
}

function lineOut(cat: Catalog, l: CatalogLine, scale: number): LineOut {
  const qty = scaledQty(l, scale);
  const out: LineOut = { lineId: l.id, itemId: l.itemId, item: cat.items[l.itemId]?.name ?? l.itemId, qty, unitPrice: l.unitPrice, cost: l.unitPrice == null ? null : round2(qty * l.unitPrice), basis: l.basis, flag: l.flag };
  if (/option/i.test(l.basis) && !/reference/i.test(l.basis)) out.exclusiveGroup = l.basis; // e.g. fan support options: pick ONE, never sum
  return out;
}

const DIAGNOSIS_TRADE: Record<string, string> = {
  Plumbing: "Plumbing", Electrical: "Electrical", HVAC: "HVAC", Appliance: "Appliance", Roofing: "Roofing",
  Carpentry: "Handyman / carpentry", Handyman: "Handyman / carpentry", Locksmith: "Locksmith"
};
/** Fee_Typical x urgency multiplier. null when the catalog has no data for the trade ("quote on site"). */
export function diagnosisFeeFor(cat: Catalog, category: string, urgency: UrgencyLevel): number | null {
  const trade = DIAGNOSIS_TRADE[category] ?? "Pest / gardening / flooring / concrete / painting";
  const fee = cat.diagnosis.find((d) => d.trade === trade)?.typical;
  return fee == null ? null : round2(fee * multiplierFor(cat, urgency));
}

export function quoteTask(cat: Catalog, input: QuoteInput, opts: { now?: Date } = {}): TaskQuote {
  const taskId = resolveTaskId(cat, input.taskId);
  const task = cat.tasks[taskId];
  const mult = multiplierFor(cat, input.urgency);
  const blank = (reasons: string[], extra: Partial<TaskQuote> = {}): TaskQuote => ({
    catalogVersion: cat.version, taskId, tier: input.tier, urgency: input.urgency, multiplier: mult, status: "QUOTE_ON_SITE", reasons, scale: 1, estJobDays: 0, trade: "", laborKey: "", laborFlag: "none",
    materials: 0, marketLabor: 0, floor: 0, laborBasis: 0, labor: 0, payout: 0, asNeeded: { options: [], selected: [], selectedTotal: 0 }, pendingReview: [], homeownerChoice: [],
    homeownerChoiceRange: null, unpriced: [], humanReview: [], needsHumanReview: false, warnings: [], diagnosisFee: null, total: 0, displayTotal: 0, ...extra
  });
  if (!task) return blank(["unknown-task"]);
  if (!task.tiers.includes(input.tier)) return blank(["tier-not-offered"]);

  const key = laborKeyFor(cat, taskId, input.tier);
  const lab = cat.labor[key];
  if (!lab || lab.rateTypical == null || lab.refQty == null) return blank(["no-labor-data"], { laborKey: key });

  const scale = input.scopeQty != null && lab.refQty > 0 ? input.scopeQty / lab.refQty : 1;
  const qtyForLabor = input.scopeQty ?? lab.refQty;
  const lines = task.lines.filter((l) => l.tier === input.tier);
  const reasons: string[] = [], warnings: string[] = [], humanReview: TaskQuote["humanReview"] = [];
  const wanted = new Set(input.asNeededLineIds ?? []);
  const selectable = lines.filter((l) => l.type === "as-needed" || l.reviewTrigger === "as-needed");
  const unknownPick = [...wanted].filter((id) => !selectable.some((l) => l.id === id));
  if (unknownPick.length) throw new RangeError(`not an as-needed line of this task and tier: ${unknownPick.join(", ")}`);
  const asNeededOptions = lines.filter((l) => l.type === "as-needed").map((l) => lineOut(cat, l, scale));
  const selected = asNeededOptions.filter((l) => wanted.has(l.lineId) && l.cost != null);
  const addonLabor = round2(selected.reduce((s, l) => s + addonLaborAmount(cat, taskId, l.basis), 0));

  // materials: base lines only
  const base = lines.filter((l) => l.type === "base");
  const unpricedBase = base.filter((l) => l.unitPrice == null);
  let blocked = false;
  if (opts.now) {
    for (const l of base) {
      const f = priceFreshness(cat.items[l.itemId]?.checkDate ?? null, opts.now);
      if (f === "blocked") blocked = true;
      else if (f === "stale") warnings.push(`stale-price:${l.itemId}`);
    }
  }
  const materials = round2(base.reduce((s, l) => s + (l.unitPrice == null ? 0 : scaledQty(l, scale) * l.unitPrice), 0));

  // labor. Add-on labor (oven, fridge, balcony, pet stain) is market labor. Urgency multiplies it. The wage floor stays the visit floor.
  const estDays = (lab.estJobDays ?? 1) * scale;
  const dailyMin = lab.dailyMin ?? 0;
  const floor = round2(dailyMin * Math.max(1, Math.ceil(estDays - 1e-9)));
  const marketLabor = round2(lab.rateTypical * qtyForLabor + addonLabor);
  const laborBasis = Math.max(marketLabor, floor);
  const labor = round2(laborBasis * mult);
  if (lab.flag === "regulated") humanReview.push({ kind: "labor", ref: key, reason: "regulated" });

  // separate lists. Flagged cleaning lines (work at height, mold) are reviewTrigger "as-needed": pending only when selected.
  const pendingReview = lines.filter((l) => triggersReview(l, wanted)).map((l) => lineOut(cat, l, scale));
  pendingReview.forEach((l) => humanReview.push({ kind: "line", ref: l.lineId, reason: l.flag }));
  const choice = [
    ...lines.filter(isChoice).map((l) => lineOut(cat, l, scale)),
    ...choiceItems(cat, task).map((i): LineOut => ({ lineId: i.id, itemId: i.id, item: i.name, qty: 1, unitPrice: i.price, cost: i.price, basis: "homeowner reference", flag: i.flag }))
  ];
  const choicePrices = choice.filter((l) => l.unitPrice != null).map((l) => l.unitPrice as number);
  const unpriced = [...lines.filter((l) => l.type !== "base" && l.unitPrice == null).map((l) => lineOut(cat, l, scale)), ...unpricedBase.map((l) => lineOut(cat, l, scale))];

  const selectedTotal = round2(selected.reduce((s, l) => s + (l.cost ?? 0), 0));
  const diagnosisFee = input.withDiagnosis ? diagnosisFeeFor(cat, task.category, input.urgency) : null;
  if (input.withDiagnosis && diagnosisFee == null) reasons.push("no-diagnosis-fee-data");

  let status: QuoteStatus = "FIXED";
  if (unpricedBase.length) { status = "QUOTE_ON_SITE"; reasons.push("unpriced-base-line"); }
  if (blocked) { status = "BLOCKED_STALE_PRICE"; reasons.push("price-older-than-30-days"); }

  const total = round2(materials + labor + selectedTotal + (diagnosisFee ?? 0));
  return {
    catalogVersion: cat.version, taskId, tier: input.tier, urgency: input.urgency, multiplier: mult, status, reasons, scale, estJobDays: estDays, trade: lab.trade, laborKey: key, laborFlag: lab.flag,
    materials, marketLabor, floor, laborBasis, labor, payout: labor,
    asNeeded: { options: asNeededOptions, selected, selectedTotal }, pendingReview, homeownerChoice: choice,
    homeownerChoiceRange: choicePrices.length ? { min: Math.min(...choicePrices), max: Math.max(...choicePrices) } : null,
    unpriced, humanReview, needsHumanReview: humanReview.length > 0, warnings, diagnosisFee, total, displayTotal: round2(total)
  };
}

export interface VisitQuote {
  catalogVersion: string; urgency: UrgencyLevel; multiplier: number; status: QuoteStatus; reasons: string[];
  jobs: { taskId: string; tier: string; materials: number; marketLabor: number; labor: number; payout: number }[];
  marketTotal: number; visitFloor: number; visitLaborBasis: number; visitLabor: number;
  materials: number; asNeeded: number; diagnosisCredit: number; total: number; displayTotal: number;
  needsHumanReview: boolean;
}
/**
 * Multi-job visit: the wage floor applies per visit day, not per task.
 * visit_labor = MAX(sum of market labor, highest daily minimum x ROUNDUP(sum of est. days)) x multiplier, split in proportion to each job's market labor.
 * ASSUMPTIONS (open): one urgency level per visit; rounding remainders go to the largest job.
 */
export function quoteVisit(
  cat: Catalog, jobs: Omit<QuoteInput, "urgency">[], urgency: UrgencyLevel, opts: { now?: Date; diagnosisFeePaid?: number } = {}
): VisitQuote {
  const mult = multiplierFor(cat, urgency);
  const parts = jobs.map((j) => quoteTask(cat, { ...j, urgency: "STANDARD" }, opts.now ? { now: opts.now } : {}));
  const bad = parts.find((p) => p.status !== "FIXED");
  const empty: VisitQuote = { catalogVersion: cat.version, urgency, multiplier: mult, status: bad?.status ?? "QUOTE_ON_SITE", reasons: bad?.reasons ?? ["no-jobs"], jobs: [], marketTotal: 0, visitFloor: 0, visitLaborBasis: 0, visitLabor: 0, materials: 0, asNeeded: 0, diagnosisCredit: 0, total: 0, displayTotal: 0, needsHumanReview: parts.some((p) => p.needsHumanReview) };
  if (bad || parts.length === 0) return empty;

  const marketTotal = round2(parts.reduce((s, p) => s + p.marketLabor, 0));
  const days = parts.reduce((s, p) => s + p.estJobDays, 0);
  const topDaily = Math.max(...parts.map((p) => cat.labor[p.laborKey]?.dailyMin ?? 0));
  const visitFloor = round2(topDaily * Math.max(1, Math.ceil(days - 1e-9)));
  const visitLaborBasis = Math.max(marketTotal, visitFloor);
  const visitLabor = round2(visitLaborBasis * mult);

  const raw = parts.map((p) => (marketTotal > 0 ? round2((visitLabor * p.marketLabor) / marketTotal) : 0));
  const remainder = round2(visitLabor - raw.reduce((s, x) => s + x, 0));
  const biggest = parts.reduce((bi, p, i) => (p.marketLabor > (parts[bi]?.marketLabor ?? -1) ? i : bi), 0);
  raw[biggest] = round2((raw[biggest] ?? 0) + remainder);

  const materials = round2(parts.reduce((s, p) => s + p.materials, 0));
  const asNeeded = round2(parts.reduce((s, p) => s + p.asNeeded.selectedTotal, 0));
  const gross = round2(materials + visitLabor + asNeeded);
  const diagnosisCredit = round2(Math.min(opts.diagnosisFeePaid ?? 0, gross));
  const total = round2(gross - diagnosisCredit);
  return {
    catalogVersion: cat.version, urgency, multiplier: mult, status: "FIXED", reasons: [],
    jobs: parts.map((p, i) => ({ taskId: p.taskId, tier: p.tier, materials: p.materials, marketLabor: p.marketLabor, labor: raw[i] ?? 0, payout: raw[i] ?? 0 })),
    marketTotal, visitFloor, visitLaborBasis, visitLabor, materials, asNeeded, diagnosisCredit, total, displayTotal: round2(total),
    needsHumanReview: parts.some((p) => p.needsHumanReview)
  };
}

/** Repair booked after a paid diagnosis: the fee is credited. Not booked: the fee stands. */
export const repairDueAfterDiagnosis = (repairTotal: number, feePaid: number): { credit: number; due: number } => {
  const credit = round2(Math.min(feePaid, repairTotal));
  return { credit, due: round2(repairTotal - credit) };
};

/**
 * On-site scope change: any change, even 0.01, needs the homeowner's in-app approval before the changed work starts.
 * If the homeowner declines, only the diagnosis fee applies (if one was shown).
 */
export function reconcileScopeChange(before: { total: number }, after: { total: number }, diagnosisFeeShown: number | null = null) {
  const delta = round2(after.total - before.total);
  return { oldTotal: before.total, newTotal: after.total, delta, needsApproval: delta !== 0, onDeclineCharge: diagnosisFeeShown ?? 0 };
}
