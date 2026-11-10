import type { Lang } from "@/core/config/fixx.config";
import {
  gasPhrases,
  rooms,
  storeyPhrases,
  storeyTokens,
  tradeKeywords,
  tradeSynonyms,
  type SynonymKind
} from "@/data/searchSynonyms";
import { catalogJobRecords } from "./catalogJobs";
import { categories } from "./data";
import fillerJson from "./searchFillers.json";

export type TradeVisual = "idle" | "strong" | "soft" | "dim";
export type SearchStatus = "idle" | "hit" | "empty" | "safety";

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
  /**
   * idle: filler, a storey, or a word still being typed. The grid stays up.
   * hit: at least one room or specific word matched.
   * empty: a finished word of 3+ letters matched nothing.
   * safety: gas. Nothing to book, and never the empty state.
   */
  status: SearchStatus;
  /** True only for status "empty". */
  empty: boolean;
  /** Set when status is "safety". */
  safety?: "gas";
}

interface FillerFile {
  phrases: string[];
  tokens: string[];
}

const MIN_TOKEN = 2;
const MIN_EMPTY = 3;

const HANGUL_PARTICLES = ["에서는", "에서도", "으로", "에서", "에게", "한테", "처럼", "까지", "부터", "보다", "마다", "은", "는", "이", "가", "을", "를", "도", "만", "과", "와", "로", "의", "요"]
  .map((particle) => particle.normalize("NFD").replace(/\p{M}/gu, ""))
  .sort((a, b) => b.length - a.length);

/**
 * These tokens must never prefix-match a longer word.
 * "sin" is not "sink", "rato" is not "rata", "tape" is not "tapete".
 */
const BLOCK = new Set(["sin", "rato", "ratos", "tape", "set", "see", "not", "now", "pro", "ref", "nos"]);

/**
 * Two letters only reach a room or a trade name, and only as a soft glow.
 * "ba" is a bathroom, "wi" is a window, "pl" is plumbing. Never a catalog title.
 */
const SHORT: Record<string, { kind: "room" | "trade"; id: string }> = {
  ba: { kind: "room", id: "bathroom" },
  ki: { kind: "room", id: "kitchen" },
  wi: { kind: "room", id: "windows" },
  do: { kind: "room", id: "doors" },
  ga: { kind: "room", id: "garage" },
  pa: { kind: "room", id: "patio" },
  ro: { kind: "room", id: "roof" },
  pl: { kind: "trade", id: "plumbing" }
};

const fillers = fillerJson as FillerFile;

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

function prepare(raw: string): string {
  return normalizeSearch(raw.replace(/a\/c/gi, "ac")).replace(/(\d+)\s+v\b/g, "$1v");
}

function stripParticle(token: string): string {
  if (!/\p{Script=Hangul}/u.test(token)) return token;
  for (const particle of HANGUL_PARTICLES) {
    if (token.length - particle.length >= MIN_TOKEN && token.endsWith(particle)) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

function normPhrase(value: string): string {
  return prepare(value).split(" ").filter(Boolean).map(stripParticle).join(" ");
}

const FILLER = new Set(fillers.tokens.map((token) => normPhrase(token)).filter(Boolean));
const fillerPhraseList = [...fillers.phrases].map(normPhrase).filter((phrase) => phrase.length > 0);
const fillerPhrases = fillerPhraseList.filter((phrase) => phrase.includes(" ")).sort((a, b) => b.length - a.length);

const storeyPhraseList = storeyPhrases.map(normPhrase).filter((phrase) => phrase.includes(" ")).sort((a, b) => b.length - a.length);
const storeyTokenSet = new Set(storeyTokens.map(normPhrase).filter(Boolean));

const gasList = [...gasPhrases].map(normPhrase).filter(Boolean).sort((a, b) => b.length - a.length);

function isFiller(token: string): boolean {
  if (FILLER.has(token) || BLOCK.has(token)) return true;
  const stem = stripParticle(token);
  return stem !== token && (FILLER.has(stem) || BLOCK.has(stem));
}

function stripPhrases(query: string, phrases: string[]): string {
  let next = ` ${query} `;
  for (const phrase of phrases) {
    const needle = ` ${phrase} `;
    if (next.includes(needle)) next = next.split(needle).join(" ");
  }
  return next.replace(/\s+/g, " ").trim();
}

/** A half-typed filler phrase ("I need help wi", "necesito", "nec", "hel"). */
function isUnderwayFiller(query: string): boolean {
  const tokens = query.split(" ").filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  for (const phrase of fillerPhraseList) {
    if (!phrase.startsWith(query) || query.length >= phrase.length) continue;
    if (query.includes(" ") || !phrase.includes(" ")) return true;
  }
  if (last.length < MIN_TOKEN || SHORT[last] || startsDictionary(last) || FILLER.has(last)) return false;
  if ([...FILLER].some((token) => token.startsWith(last) && token !== last)) return true;
  return false;
}

function isUnderwayStorey(query: string): boolean {
  const tokens = query.split(" ").filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  if (isStoreyPrefix(last) && !startsDictionary(last) && !SHORT[last]) return true;
  const tails = [tokens.slice(-2).join(" "), tokens.slice(-3).join(" ")].filter((tail) => tail.includes(" "));
  return storeyPhraseList.some((phrase) => tails.some((tail) => phrase.startsWith(tail) && tail.length < phrase.length));
}

function isStoreyPrefix(token: string): boolean {
  if (token.length < MIN_TOKEN) return false;
  for (const storey of storeyTokenSet) {
    if (!storey.startsWith(token) || storey === token) continue;
    if (/\p{Script=Hangul}/u.test(storey) || token.length >= MIN_EMPTY) return true;
  }
  return false;
}

function isGas(query: string): boolean {
  if (query.includes("가스")) return true;
  const padded = ` ${query} `;
  return gasList.some((phrase) => phrase && padded.includes(` ${phrase} `));
}

interface PoolEntry {
  phrase: string;
  kind: SynonymKind | "room" | "trade";
  tradeId: string;
  trades: string[];
  related: string[];
  jobs: string[];
  vague: boolean;
  roomId?: string;
  narrow?: boolean;
}

interface Hit {
  entry: PoolEntry;
  position: number;
  soft: boolean;
}

function listed(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    const phrase = normPhrase(word);
    if (phrase.length < MIN_TOKEN || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
  }
  return out;
}

const pool: PoolEntry[] = [
  ...tradeSynonyms.flatMap((entry) => listed(entry.words).map((phrase) => ({
    phrase,
    kind: entry.kind ?? "object",
    tradeId: entry.tradeId,
    trades: entry.trades?.length ? entry.trades : [entry.tradeId],
    related: (entry.related ?? []).slice(0, entry.kind === "broad" ? 0 : 1),
    jobs: entry.jobs ?? [],
    vague: entry.vague === true
  }))),
  ...rooms.flatMap((room) => listed(room.words).map((phrase) => ({
    phrase,
    kind: "room" as const,
    tradeId: room.primary?.[0] ?? room.trades[0] ?? room.id,
    trades: room.trades,
    related: [],
    jobs: room.jobs ?? [],
    vague: false,
    roomId: room.id,
    narrow: room.narrow === true
  }))),
  ...tradeKeywords.flatMap((entry) => listed(entry.words).map((phrase) => ({
    phrase,
    kind: "trade" as const,
    tradeId: entry.tradeId,
    trades: [entry.tradeId],
    related: [],
    jobs: entry.jobs ?? [],
    vague: false
  })))
].sort((a, b) => b.phrase.length - a.phrase.length || b.phrase.split(" ").length - a.phrase.split(" ").length || a.phrase.localeCompare(b.phrase));

const dictionaryWords = [...new Set(pool.flatMap((entry) => entry.phrase.split(" ")))];

function startsDictionary(token: string): boolean {
  if (token.length < MIN_TOKEN || BLOCK.has(token)) return false;
  return dictionaryWords.some((word) => word.startsWith(token) && word !== token);
}

function sameWord(token: string, term: string): boolean {
  if (token === term) return true;
  if (/\p{Script=Hangul}/u.test(token) || /\p{Script=Hangul}/u.test(term)) return false;
  return token === `${term}s` || token === `${term}es` || term === `${token}s` || term === `${token}es`;
}

function isPartial(token: string, term: string): boolean {
  if (BLOCK.has(token) || token.length < MIN_EMPTY || token.length >= term.length) return false;
  return term.startsWith(token);
}

function exactSpan(tokens: string[], phrase: string, consumed: Set<number>): number[] | null {
  const parts = phrase.split(" ").filter(Boolean);
  if (parts.length === 0 || parts.length > tokens.length) return null;
  for (let start = 0; start <= tokens.length - parts.length; start += 1) {
    const indexes: number[] = [];
    let matched = true;
    for (let offset = 0; offset < parts.length; offset += 1) {
      if (!sameWord(tokens[start + offset] ?? "", parts[offset] ?? "")) { matched = false; break; }
      indexes.push(start + offset);
    }
    if (matched && indexes.every((index) => !consumed.has(index))) return indexes;
  }
  return null;
}

function partialSpan(tokens: string[], phrase: string): number[] | null {
  const parts = phrase.split(" ").filter(Boolean);
  const end = tokens.length - 1;
  const start = end - (parts.length - 1);
  if (parts.length === 0 || start < 0) return null;
  for (let offset = 0; offset < parts.length - 1; offset += 1) {
    if (!sameWord(tokens[start + offset] ?? "", parts[offset] ?? "")) return null;
  }
  const token = tokens[end] ?? "";
  const last = parts[parts.length - 1] ?? "";
  if (!isPartial(token, last)) return null;
  return Array.from({ length: parts.length }, (_, offset) => start + offset);
}

interface IndexedJob {
  id: string;
  categoryId: string;
  titles: Record<Lang, string>;
  pendingReview: boolean;
}

const indexedJobs: IndexedJob[] = catalogJobRecords().map((job) => ({
  id: job.id,
  categoryId: job.categoryId,
  titles: job.titles,
  pendingReview: job.pendingReview
}));
const jobById = new Map(indexedJobs.map((job) => [job.id, job]));
const tradeIds = categories.map((category) => category.id);
const tradeName = new Map(categories.map((category) => [category.id, category.names]));

function idleTrades(): Record<string, TradeVisual> {
  return Object.fromEntries(tradeIds.map((id) => [id, "idle" as const]));
}

function idleResult(query: string): SearchResult {
  return { query, trades: idleTrades(), chips: [], tradeCount: 0, jobCount: 0, status: "idle", empty: false };
}

function safetyResult(query: string): SearchResult {
  return { query, trades: idleTrades(), chips: [], tradeCount: 0, jobCount: 0, status: "safety", empty: false, safety: "gas" };
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j] ?? 0, row[j - 1] ?? 0) + 1;
      prev = row[j] ?? 0;
      row[j] = next;
    }
  }
  return row[b.length] ?? 0;
}

function suggest(token: string): string | null {
  if (token.length < 5 || BLOCK.has(token) || FILLER.has(token)) return null;
  let best: string | null = null;
  for (const word of dictionaryWords) {
    if (word.length < 4 || Math.abs(word.length - token.length) > 1) continue;
    if (levenshtein(token, word) !== 1) continue;
    if (best && best !== word) return null;
    best = word;
  }
  return best;
}

function collect(tokens: string[]): { hits: Hit[]; consumed: Set<number> } {
  const consumed = new Set<number>();
  const hits: Hit[] = [];
  const take = (entry: PoolEntry, span: number[], soft = false) => {
    if (span.some((index) => consumed.has(index))) return false;
    span.forEach((index) => consumed.add(index));
    hits.push({ entry, position: span[0] ?? 0, soft });
    return true;
  };
  for (const entry of pool) {
    const span = exactSpan(tokens, entry.phrase, consumed);
    if (span) take(entry, span);
  }
  const last = tokens.length - 1;
  if (last >= 0 && !consumed.has(last)) {
    const token = tokens[last] ?? "";
    const curated = token.length === MIN_TOKEN ? SHORT[token] : undefined;
    if (curated?.kind === "room") {
      const entry = pool.find((item) => item.kind === "room" && item.roomId === curated.id);
      if (entry) take(entry, [last]);
    } else if (curated?.kind === "trade") {
      take({
        phrase: token,
        kind: "trade",
        tradeId: curated.id,
        trades: [curated.id],
        related: [],
        jobs: [],
        vague: false
      }, [last], true);
    } else {
      let best: { entry: PoolEntry; span: number[]; extra: number } | null = null;
      for (const entry of pool) {
        const span = partialSpan(tokens, entry.phrase);
        if (!span || span.some((index) => consumed.has(index))) continue;
        const parts = entry.phrase.split(" ");
        const extra = (parts[parts.length - 1]?.length ?? 0) - token.length;
        const closer = !best || extra < best.extra || (extra === best.extra && entry.jobs.length > best.entry.jobs.length);
        if (closer) best = { entry, span, extra };
      }
      if (best) take(best.entry, best.span);
    }
  }
  return { hits, consumed };
}

function chipsFrom(ids: string[], position: number, order: Map<string, number>): void {
  ids.forEach((id, index) => {
    if (!jobById.has(id)) return;
    const next = position * 20 + index;
    const prev = order.get(id);
    if (prev == null || next < prev) order.set(id, next);
  });
}

function finish(query: string, tokens: string[], hits: Hit[], consumed: Set<number>, lang: Lang, corrected: boolean): SearchResult {
  const objects = hits.filter((hit) => hit.entry.kind === "object" || hit.entry.kind === "trade");
  const symptoms = hits.filter((hit) => hit.entry.kind === "symptom");
  const broads = hits.filter((hit) => hit.entry.kind === "broad");
  const roomHits = hits.filter((hit) => hit.entry.kind === "room");
  const specific = objects.length > 0 || symptoms.length > 0;
  const level = new Map<string, number>();
  const add = (id: string, next: number) => {
    if (!tradeName.has(id)) return;
    level.set(id, Math.max(level.get(id) ?? 0, next));
  };
  const chipOrder = new Map<string, number>();

  if (objects.length > 0) {
    for (const hit of objects) {
      add(hit.entry.tradeId, hit.soft ? 1 : 2);
      for (const id of hit.entry.related) add(id, 1);
      chipsFrom(hit.entry.jobs, hit.position, chipOrder);
    }
  } else if (symptoms.length > 0) {
    for (const hit of symptoms) {
      add(hit.entry.tradeId, 2);
      for (const id of hit.entry.related) add(id, 1);
    }
    const vague = symptoms.some((hit) => hit.entry.vague);
    if (vague && roomHits.length > 0) {
      const symptomTrades = new Set(symptoms.map((hit) => hit.entry.tradeId));
      for (const hit of roomHits) {
        if (hit.entry.roomId === "windows" && symptomTrades.has("handyman")) {
          chipsFrom(["FIXX-HND-003", "FIXX-HND-004"], hit.position, chipOrder);
          continue;
        }
        const jobs = hit.entry.jobs.filter((id) => {
          const job = jobById.get(id);
          return job != null && symptomTrades.has(job.categoryId);
        });
        chipsFrom(jobs, hit.position, chipOrder);
      }
      if (chipOrder.size === 0) for (const hit of symptoms) chipsFrom(hit.entry.jobs, hit.position, chipOrder);
    } else {
      for (const hit of symptoms) chipsFrom(hit.entry.jobs, hit.position, chipOrder);
    }
  } else {
    for (const hit of [...roomHits, ...broads]) for (const id of hit.entry.trades) add(id, 1);
    const ordered = [...roomHits].sort((a, b) => Number(b.entry.narrow) - Number(a.entry.narrow) || a.position - b.position);
    if (ordered.length === 1) chipsFrom(ordered[0]?.entry.jobs.slice(0, 2) ?? [], ordered[0]?.position ?? 0, chipOrder);
    else ordered.slice(0, 2).forEach((hit, index) => chipsFrom(hit.entry.jobs.slice(0, 1), index, chipOrder));
  }

  if (level.size === 0) {
    const leftovers = tokens.filter((token, index) => !consumed.has(index) && !isFiller(token) && !storeyTokenSet.has(token) && !/^\d+$/.test(token));
    if (!corrected) {
      let changed = false;
      const next = tokens.map((token, index) => {
        if (consumed.has(index) || isFiller(token) || storeyTokenSet.has(token)) return token;
        const guessed = suggest(token);
        if (!guessed) return token;
        changed = true;
        return guessed;
      });
      if (changed) {
        const again = collect(next);
        return finish(query, next, again.hits, again.consumed, lang, true);
      }
    }
    const ready = leftovers.some((token) => token.length >= MIN_EMPTY);
    if (!ready) return idleResult(query);
    const trades = Object.fromEntries(tradeIds.map((id) => [id, "dim" as const]));
    return { query, trades, chips: [], tradeCount: 0, jobCount: 0, status: "empty", empty: true };
  }

  const trades: Record<string, TradeVisual> = {};
  for (const id of tradeIds) {
    const tier = level.get(id) ?? 0;
    trades[id] = tier >= 2 ? "strong" : tier === 1 ? "soft" : "dim";
  }
  const chips = [...chipOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, specific ? 3 : 2)
    .flatMap(([id]): SearchChip[] => {
      const job = jobById.get(id);
      const trade = job ? tradeName.get(job.categoryId) : undefined;
      if (!job || !trade) return [];
      return [{
        taskId: job.id,
        categoryId: job.categoryId,
        title: job.titles[lang],
        tradeName: trade[lang],
        pendingReview: job.pendingReview,
        score: 100 - (chipOrder.get(id) ?? 0)
      }];
    });
  return {
    query,
    trades,
    chips,
    tradeCount: tradeIds.filter((id) => (level.get(id) ?? 0) > 0).length,
    jobCount: chips.length,
    status: "hit",
    empty: false
  };
}

/**
 * Broad to specific.
 * Gas wins first and books nothing. Filler, storeys, and a half-typed
 * context word stay idle. A specific object or problem glows its trade
 * strong and turns a room's list off. A room alone stays a soft list.
 * Catalog titles never light a trade by themselves.
 */
export function searchServices(raw: string, lang: Lang): SearchResult {
  const query = prepare(raw);
  if (!query) return idleResult(query);
  if (isGas(query)) return safetyResult(query);
  if (isUnderwayFiller(query) || isUnderwayStorey(query)) return idleResult(query);
  const stripped = stripPhrases(stripPhrases(query, fillerPhrases), storeyPhraseList);
  const tokens = stripped.split(" ").filter(Boolean).map(stripParticle)
    .filter((token) => (token.length >= MIN_TOKEN || /^\d+$/.test(token)) && !storeyTokenSet.has(token));
  if (tokens.length === 0 || tokens.every((token) => isFiller(token))) return idleResult(query);
  const { hits, consumed } = collect(tokens);
  return finish(query, tokens, hits, consumed, lang, false);
}
