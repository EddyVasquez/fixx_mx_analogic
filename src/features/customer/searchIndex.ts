import type { Lang } from "@/core/config/fixx.config";
import { catalogJobRecords } from "./catalogJobs";
import { categories } from "./data";
import slangJson from "./searchSlang.json";

export type TradeVisual = "idle" | "strong" | "soft" | "dim";

export interface SearchChip {
  taskId: string;
  categoryId: string;
  title: string;
  tradeName: string;
  pendingReview: boolean;
  score: number;
}

export interface SearchResult {
  query: string;
  trades: Record<string, TradeVisual>;
  chips: SearchChip[];
  tradeCount: number;
  jobCount: number;
  /** True when the query is non-empty and nothing matched. */
  empty: boolean;
}

interface SlangGroup {
  id: string;
  phrases: string[];
  requiresAny?: string[];
  primaryTradeId: string;
  primaryJobIds?: string[];
  relatedTradeIds?: string[];
  relatedJobIds?: string[];
}

const STOP = new Set([
  "a", "an", "the", "of", "to", "at", "and", "or", "for", "in", "on", "my", "is", "it",
  "el", "la", "los", "las", "de", "del", "un", "una", "y", "o", "en", "con", "para", "por", "al", "se", "que", "mi", "lo"
]);

const STRONG_SCORE = 80;

/** Lowercase, strip accents, and collapse whitespace so "tapó" matches "tapo". */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return value.split(" ").filter((token) => token.length >= 2 && !STOP.has(token));
}

function containsPhrase(query: string, phrase: string): boolean {
  if (!phrase) return false;
  if (query === phrase) return true;
  return ` ${query} `.includes(` ${phrase} `);
}

function titleScore(query: string, title: string): number {
  if (!query || !title) return 0;
  if (title === query) return 100;
  if (query.length >= 3 && title.includes(query)) return 90;
  if (title.length >= 3 && query.includes(title)) return 85;
  const qTokens = tokens(query);
  const tTokens = tokens(title);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;
  const prefixHit = (left: string, right: string) => left.length >= 5 && right.startsWith(left);
  let hits = 0;
  for (const qt of qTokens) {
    if (tTokens.some((tt) => tt === qt || prefixHit(qt, tt) || prefixHit(tt, qt))) hits += 1;
  }
  if (hits === 0) return 0;
  if (qTokens.length === 1) {
    const qt = qTokens[0] ?? "";
    if (tTokens.includes(qt) || (qt.length >= 5 && tTokens.some((tt) => prefixHit(qt, tt) || prefixHit(tt, qt)))) return 85;
  }
  // One shared word in a longer question (for example "baño" inside "se tapó el baño") is not a job match.
  if (hits < 2) return 0;
  return Math.min(75, 40 + hits * 15);
}

interface IndexedJob {
  id: string;
  categoryId: string;
  titles: Record<Lang, string>;
  normalizedTitles: string[];
  pendingReview: boolean;
}

interface IndexedTrade {
  id: string;
  names: Record<Lang, string>;
  normalizedNames: string[];
}

const indexedJobs: IndexedJob[] = catalogJobRecords().map((job) => ({
  id: job.id,
  categoryId: job.categoryId,
  titles: job.titles,
  normalizedTitles: [job.titles.en, job.titles.es, job.titles.ko].map(normalizeSearch),
  pendingReview: job.pendingReview
}));

const indexedTrades: IndexedTrade[] = categories.map((category) => ({
  id: category.id,
  names: category.names,
  normalizedNames: [category.names.en, category.names.es, category.names.ko].map(normalizeSearch)
}));

const jobById = new Map(indexedJobs.map((job) => [job.id, job]));
const tradeById = new Map(indexedTrades.map((trade) => [trade.id, trade]));

const slangGroups: SlangGroup[] = (slangJson.groups as SlangGroup[]).map((group) => ({
  ...group,
  phrases: group.phrases.map(normalizeSearch),
  requiresAny: group.requiresAny?.map(normalizeSearch)
}));

function groupMatches(query: string, group: SlangGroup): boolean {
  if (!group.phrases.some((phrase) => containsPhrase(query, phrase))) return false;
  if (!group.requiresAny?.length) return true;
  return group.requiresAny.some((phrase) => containsPhrase(query, phrase));
}

/**
 * Client-side match against trade names, catalog job titles (EN/ES/KO) and the slang list.
 * Job ids in the slang file that are not in the catalog are skipped.
 */
export function searchServices(raw: string, lang: Lang): SearchResult {
  const query = normalizeSearch(raw);
  const idle = Object.fromEntries(indexedTrades.map((trade) => [trade.id, "idle" as const]));
  if (!query) return { query, trades: idle, chips: [], tradeCount: 0, jobCount: 0, empty: false };

  const tradeLevel = new Map<string, number>();
  const jobScore = new Map<string, number>();
  const jobOrder = new Map<string, number>();

  const bumpTrade = (id: string, level: number) => {
    if (!tradeById.has(id)) return;
    tradeLevel.set(id, Math.max(tradeLevel.get(id) ?? 0, level));
  };
  const bumpJob = (id: string, score: number, order: number) => {
    const job = jobById.get(id);
    if (!job || score <= 0) return;
    if (score > (jobScore.get(id) ?? 0)) jobScore.set(id, score);
    const previous = jobOrder.get(id);
    if (previous == null || order < previous) jobOrder.set(id, order);
    bumpTrade(job.categoryId, score >= STRONG_SCORE ? 2 : 1);
  };

  const exactTradeIds = new Set(
    indexedTrades
      .filter((trade) => trade.normalizedNames.some((name) => name === query))
      .map((trade) => trade.id)
  );

  for (const trade of indexedTrades) {
    const named = trade.normalizedNames.some((name) =>
      name === query || (query.length >= 3 && name.length >= 3 && (name.includes(query) || query.includes(name)))
    );
    if (named) bumpTrade(trade.id, 2);
  }

  indexedJobs.forEach((job, index) => {
    const crossed = exactTradeIds.size > 0 && !exactTradeIds.has(job.categoryId);
    let best = 0;
    for (const title of job.normalizedTitles) {
      if (crossed) {
        if (title === query) best = 100;
      } else best = Math.max(best, titleScore(query, title));
    }
    if (best > 0) bumpJob(job.id, best, 1000 + index);
  });

  let slangOrder = 0;
  for (const group of slangGroups) {
    if (!groupMatches(query, group)) continue;
    bumpTrade(group.primaryTradeId, 2);
    for (const id of group.relatedTradeIds ?? []) bumpTrade(id, 1);
    for (const id of group.primaryJobIds ?? []) bumpJob(id, 100, slangOrder++);
    for (const id of group.relatedJobIds ?? []) bumpJob(id, 50, slangOrder++);
  }

  const trades: Record<string, TradeVisual> = {};
  let tradeCount = 0;
  for (const trade of indexedTrades) {
    const level = tradeLevel.get(trade.id) ?? 0;
    trades[trade.id] = level >= 2 ? "strong" : level === 1 ? "soft" : "dim";
    if (level > 0) tradeCount += 1;
  }

  const chips = [...jobScore.entries()]
    .map(([id, score]) => ({ id, score, order: jobOrder.get(id) ?? 9999 }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 3)
    .flatMap((hit): SearchChip[] => {
      const job = jobById.get(hit.id);
      const trade = job ? tradeById.get(job.categoryId) : undefined;
      if (!job || !trade) return [];
      return [{
        taskId: job.id,
        categoryId: job.categoryId,
        title: job.titles[lang],
        tradeName: trade.names[lang],
        pendingReview: job.pendingReview,
        score: hit.score
      }];
    });

  return {
    query,
    trades,
    chips,
    tradeCount,
    jobCount: chips.length,
    empty: tradeCount === 0
  };
}
