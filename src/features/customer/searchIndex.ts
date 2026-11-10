import type { Lang } from "@/core/config/fixx.config";
import { rooms, storeyPhrases, storeyTokens, tradeSynonyms, type RoomSynonym } from "@/data/searchSynonyms";
import { catalogJobRecords } from "./catalogJobs";
import { categories } from "./data";
import fillerJson from "./searchFillers.json";
import slangJson from "./searchSlang.json";

export type TradeVisual = "idle" | "strong" | "soft" | "dim";
export type SearchStatus = "idle" | "hit" | "empty";

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
   * idle: filler or still too short to judge. The grid stays at full strength.
   * hit: at least one trigger token matched. Unmatched words do not cancel it.
   * empty: a real token of 3+ characters matched nothing.
   */
  status: SearchStatus;
  /** True only for status "empty". A one-letter or filler query is not empty. */
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

interface FillerFile {
  phrases: string[];
  tokens: string[];
}

const STRONG_SCORE = 80;
/** A 2-character token can light a prefix hit, but it is too short to declare "no matches". */
const MIN_TOKEN = 2;
const MIN_EMPTY = 3;

const HANGUL_PARTICLES = ["에서는", "에서도", "으로", "에서", "에게", "한테", "처럼", "까지", "부터", "보다", "마다", "은", "는", "이", "가", "을", "를", "도", "만", "과", "와", "로", "의", "요"]
  .sort((a, b) => b.length - a.length);

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

const FILLER = new Set(fillers.tokens.map((token) => normalizeSearch(token)).filter(Boolean));

/** Every filler phrase, longest first, including one-word Korean phrases. */
const fillerPhraseList = [...new Set(fillers.phrases.map((phrase) => normalizeSearch(phrase)).filter((phrase) => phrase.length >= MIN_TOKEN))]
  .sort((a, b) => b.length - a.length);

const fillerPhrases = fillerPhraseList.filter((phrase) => phrase.includes(" "));

function stripFillerPhrases(query: string): string {
  let next = ` ${query} `;
  for (const phrase of fillerPhrases) {
    const needle = ` ${phrase} `;
    if (next.includes(needle)) next = next.split(needle).join(" ");
  }
  return next.replace(/\s+/g, " ").trim();
}

/**
 * The customer is still typing a filler phrase.
 * "I need help wi" is "I need help with". "necesito ayuda co" is "con".
 * "도움이 필요하" and "고쳐주" are the same in Korean.
 * A lone token is left alone when the phrase has more words, so "wi" and "pl"
 * keep the 2-character prefix match. A one-word phrase still counts
 * ("고쳐주" continues "고쳐주세요").
 */
function isUnderwayFillerPhrase(query: string): boolean {
  for (const phrase of fillerPhraseList) {
    if (!phrase.startsWith(query)) continue;
    if (query.length >= phrase.length) return true;
    if (query.includes(" ") || !phrase.includes(" ")) return true;
  }
  return false;
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

function isFiller(token: string): boolean {
  if (FILLER.has(token)) return true;
  const stem = stripParticle(token);
  return stem !== token && FILLER.has(stem);
}

/** Words that can hit a trade, a job title, or slang. Filler and 1-character tokens are dropped. */
function meaningfulTokens(value: string): string[] {
  const out: string[] = [];
  for (const raw of value.split(" ")) {
    if (raw.length < MIN_TOKEN || /^\d+$/.test(raw) || isFiller(raw)) continue;
    const token = stripParticle(raw);
    if (token.length < MIN_TOKEN || /^\d+$/.test(token) || FILLER.has(token)) continue;
    out.push(token);
  }
  return out;
}

function contentTokens(value: string): string[] {
  return meaningfulTokens(normalizeSearch(value));
}

/** A token that can light a trade. Filler words stay in the phrase window ("no hay luz") but never match on their own. */
function isContentToken(token: string): boolean {
  return token.length >= MIN_TOKEN && !/^\d+$/.test(token) && !isFiller(token);
}

const STOREY_PATTERNS = [
  String.raw`\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|ground|top|upper|lower|(?:[1-9]|1\d|2\d)(?:st|nd|rd|th)?)\s+floors?\b`,
  String.raw`\b(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|(?:[1-9]|1\d|2\d)(?:er|do|ro|to|o)?)\s+pisos?\b`,
  String.raw`\b(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa])\s+plantas?\b`,
  String.raw`\bnivel(?:es)?\s+(?:de\s+)?(?:arriba|abajo)\b`,
  String.raw`\b(?:primer[oa]?|segund[oa]|tercer[oa]?|(?:[1-9]|1\d|2\d)(?:er|do|ro|to|o)?)\s+nivel(?:es)?\b`,
  String.raw`\bplantas?\s+(?:alta|baja)\b`,
  String.raw`\bpisos?\s+de\s+(?:arriba|abajo)\b`
];

const storeyPhraseList = storeyPhrases
  .map((phrase) => normalizeSearch(phrase))
  .filter((phrase) => phrase.includes(" "))
  .sort((a, b) => b.length - a.length);

const storeyTokenSet = new Set(storeyTokens.map((token) => normalizeSearch(token)).filter(Boolean));

/** "Second floor" / "segundo piso" / "2층" is which storey, not a floor covering. */
function stripStorey(query: string): string {
  let next = ` ${query} `;
  for (const phrase of storeyPhraseList) {
    const needle = ` ${phrase} `;
    if (next.includes(needle)) next = next.split(needle).join(" ");
  }
  next = next.replace(/\s+/g, " ").trim();
  for (const source of STOREY_PATTERNS) next = next.replace(new RegExp(source, "g"), " ");
  return next
    .split(" ")
    .filter((token) => token && !storeyTokenSet.has(token) && !/^\d+층$/.test(token))
    .join(" ");
}

interface PhraseEntry {
  phrase: string;
  tradeId: string;
  related: string[];
  jobs: string[];
  score: number;
}

interface RoomPhrase {
  phrase: string;
  room: RoomSynonym;
}

function listedPhrases(words: string[]): string[] {
  return words.map((word) => normalizeSearch(word)).filter((phrase) => phrase.length >= MIN_TOKEN);
}

const synonymPhrases: PhraseEntry[] = tradeSynonyms
  .flatMap((entry) => listedPhrases(entry.words).map((phrase) => ({
    phrase,
    tradeId: entry.tradeId,
    related: entry.related ?? [],
    jobs: entry.jobs ?? [],
    score: entry.score ?? 100
  })))
  .sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase));

const roomPhrases: RoomPhrase[] = rooms
  .flatMap((room) => listedPhrases(room.words).map((phrase) => ({ phrase, room })))
  .sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase));

/**
 * Single words that already mean something. "lavar" must not prefix-match
 * "lavadora", and "ac" must not prefix-match "acero". A typed stem that is
 * not its own word still reaches the longer word ("fug" -> "fuga").
 */
const reservedTokens = new Set<string>([
  ...synonymPhrases.filter((entry) => !entry.phrase.includes(" ")).map((entry) => entry.phrase),
  ...roomPhrases.filter((entry) => !entry.phrase.includes(" ")).map((entry) => entry.phrase)
]);

/**
 * Synonym and room words. Trade names and the slang list keep the wider
 * prefix rule ("pl" -> plumbing, "prot" -> protecciones).
 */
function synonymTokenHit(token: string, term: string): boolean {
  if (token === term) return true;
  if (token.startsWith(term)) return token.length - term.length <= 2;
  if (!term.startsWith(token)) return false;
  const extra = term.length - token.length;
  if (extra <= 2) return true;
  return token.length >= 3 && extra <= 14 && !reservedTokens.has(token);
}

function phraseSpan(tokens: string[], phrase: string): number[] | null {
  const parts = phrase.split(" ").filter(Boolean);
  const size = parts.length;
  if (size === 0) return null;
  if (size === 1) {
    const part = parts[0] ?? "";
    const index = tokens.findIndex((token) => isContentToken(token) && synonymTokenHit(token, part));
    return index >= 0 ? [index] : null;
  }
  for (let start = 0; start <= tokens.length - size; start += 1) {
    const indexes: number[] = [];
    let matched = true;
    for (let offset = 0; offset < size; offset += 1) {
      const token = tokens[start + offset];
      const part = parts[offset];
      if (!token || !part) { matched = false; break; }
      const hit = offset === size - 1 ? synonymTokenHit(token, part) : token === part;
      if (!hit) { matched = false; break; }
      indexes.push(start + offset);
    }
    if (matched) return indexes;
  }
  return null;
}

/** Whole-phrase hit, including a phrase whose middle word is shorter than a token. */
function locatePhrase(query: string, tokens: string[], phrase: string): number[] | null {
  const span = phraseSpan(tokens, phrase);
  if (span) return span;
  if (!phrase.includes(" ") || !containsPhrase(query, phrase)) return null;
  const parts = new Set(phrase.split(" "));
  return tokens.flatMap((token, index) => (parts.has(token) ? [index] : []));
}

function spanIsFree(tokens: string[], span: number[], consumed: Set<string>): boolean {
  const content = span.filter((index) => isContentToken(tokens[index] ?? ""));
  if (content.length === 0) return span.length === 0;
  return content.some((index) => !consumed.has(tokens[index] ?? ""));
}

function consumeSpan(tokens: string[], span: number[], consumed: Set<string>): void {
  for (const index of span) {
    const token = tokens[index];
    if (token && isContentToken(token)) consumed.add(token);
  }
}

/**
 * Query token hits a catalog or slang word.
 * "pl" hits "plumbing" / "plomería". "변기를" hits "변기" (short Hangul particle).
 * "toilets" hits "toilet".
 */
function tokenHitsTerm(queryToken: string, term: string): boolean {
  if (queryToken.length < MIN_TOKEN || term.length < MIN_TOKEN) return false;
  if (term.startsWith(queryToken)) return true;
  if (!queryToken.startsWith(term)) return false;
  const extra = queryToken.length - term.length;
  const limit = /\p{Script=Hangul}/u.test(term) ? 4 : 2;
  return extra > 0 && extra <= limit;
}

function containsPhrase(query: string, phrase: string): boolean {
  if (!phrase) return false;
  if (query === phrase) return true;
  return ` ${query} `.includes(` ${phrase} `);
}

function phraseTokens(phrase: string): string[] {
  return phrase.split(" ").filter((token) => token.length >= MIN_TOKEN);
}

interface IndexedJob {
  id: string;
  categoryId: string;
  titles: Record<Lang, string>;
  tokens: string[];
  pendingReview: boolean;
}

interface IndexedTrade {
  id: string;
  names: Record<Lang, string>;
  tokens: string[];
}

const indexedJobs: IndexedJob[] = catalogJobRecords().map((job) => ({
  id: job.id,
  categoryId: job.categoryId,
  titles: job.titles,
  tokens: contentTokens([job.titles.en, job.titles.es, job.titles.ko].join(" ")),
  pendingReview: job.pendingReview
}));

const indexedTrades: IndexedTrade[] = categories.map((category) => ({
  id: category.id,
  names: category.names,
  tokens: contentTokens([category.names.en, category.names.es, category.names.ko].join(" "))
}));

const jobById = new Map(indexedJobs.map((job) => [job.id, job]));
const tradeById = new Map(indexedTrades.map((trade) => [trade.id, trade]));

const slangGroups: SlangGroup[] = (slangJson.groups as SlangGroup[]).map((group) => ({
  ...group,
  phrases: group.phrases.map(normalizeSearch),
  requiresAny: group.requiresAny?.map(normalizeSearch)
}));

function tokenHitsPhrase(token: string, phrase: string): boolean {
  return phraseTokens(phrase).some((part) => tokenHitsTerm(token, part));
}

function groupMatches(query: string, tokens: string[], group: SlangGroup): boolean {
  const phraseHit = group.phrases.some((phrase) => containsPhrase(query, phrase) || tokens.some((token) => tokenHitsPhrase(token, phrase)));
  if (!phraseHit) return false;
  if (!group.requiresAny?.length) return true;
  return group.requiresAny.some((phrase) => containsPhrase(query, phrase) || tokens.some((token) => tokenHitsPhrase(token, phrase)));
}

function titleScore(queryTokens: string[], titleTokens: string[]): number {
  let matched = 0;
  let best = 0;
  for (const qt of queryTokens) {
    let tokenBest = 0;
    for (const tt of titleTokens) {
      if (qt === tt) tokenBest = Math.max(tokenBest, 90);
      else if (tt.startsWith(qt) && qt.length >= 3) tokenBest = Math.max(tokenBest, 84);
      else if (tt.startsWith(qt)) tokenBest = Math.max(tokenBest, 70);
      else if (tokenHitsTerm(qt, tt)) tokenBest = Math.max(tokenBest, 86);
    }
    if (tokenBest > 0) {
      matched += 1;
      best = Math.max(best, tokenBest);
    }
  }
  if (matched === 0) return 0;
  if (matched >= 2) return Math.min(98, best + 8);
  return best;
}

function idleResult(query: string): SearchResult {
  const trades = Object.fromEntries(indexedTrades.map((trade) => [trade.id, "idle" as const]));
  return { query, trades, chips: [], tradeCount: 0, jobCount: 0, status: "idle", empty: false };
}

/**
 * Match trade names, catalog titles (EN/ES/KO), slang, and the lay-word map
 * in src/data/searchSynonyms.ts. One trigger is enough. Words that match
 * nothing are ignored, and they never turn a hit into the empty state.
 * Filler, a half-typed filler phrase ("I need help wi"), a storey
 * ("second floor"), and a single letter stay idle. "wi" or "pl" alone
 * still prefix-matches, because that query is not a filler phrase.
 * A direct word glows strong. A room by itself glows soft. A room can also
 * name one strong trade (a bathroom glows Plumbing strong). Once any
 * specific word or that strong trade hits, the other trades from the room
 * stay off, and the count drops with them.
 * Job chips stay at three. Room chips are used only when no direct word
 * suggested a job, and only the first two. Unknown slang job ids are skipped.
 */
export function searchServices(raw: string, lang: Lang): SearchResult {
  const query = normalizeSearch(raw.replace(/a\/c/gi, "ac"));
  if (!query || isUnderwayFillerPhrase(query)) return idleResult(query);

  const stripped = stripStorey(stripFillerPhrases(query));
  const tokens = meaningfulTokens(stripped);
  if (tokens.length === 0) return idleResult(query);
  const phraseTokens = stripped.split(" ").filter((token) => token.length >= MIN_TOKEN);

  // Specific hits (a lay word, a trade name, slang, a catalog title, or a
  // room's own strong trade) outrank a room's soft list.
  const specificLevel = new Map<string, number>();
  const roomLevel = new Map<string, number>();
  const jobScore = new Map<string, number>();
  const jobOrder = new Map<string, number>();
  const roomJobIds = new Set<string>();

  const bumpSpecific = (id: string, level: number) => {
    if (!tradeById.has(id)) return;
    specificLevel.set(id, Math.max(specificLevel.get(id) ?? 0, level));
  };
  const bumpRoom = (id: string, level: number) => {
    if (!tradeById.has(id)) return;
    roomLevel.set(id, Math.max(roomLevel.get(id) ?? 0, level));
  };
  const bumpJob = (id: string, score: number, order: number, fromRoom = false) => {
    const job = jobById.get(id);
    if (!job || score <= 0) return;
    if (score > (jobScore.get(id) ?? 0)) jobScore.set(id, score);
    const previous = jobOrder.get(id);
    if (previous == null || order < previous) jobOrder.set(id, order);
    const level = score >= STRONG_SCORE ? 2 : 1;
    if (fromRoom) {
      roomJobIds.add(id);
      bumpRoom(job.categoryId, level);
    } else {
      bumpSpecific(job.categoryId, level);
    }
  };

  for (const trade of indexedTrades) {
    if (tokens.some((token) => trade.tokens.some((name) => tokenHitsTerm(token, name)))) bumpSpecific(trade.id, 2);
  }

  const matchedGroups = slangGroups.filter((group) => groupMatches(stripped, tokens, group));
  // Slang keeps a word from also matching a catalog title. The room can still
  // match ("baño" inside "se tapó el baño"); its soft trades drop out below
  // once a specific word has already hit.
  const slangHit = new Set<string>();
  for (const group of matchedGroups) {
    for (const token of tokens) {
      if (group.phrases.some((phrase) => tokenHitsPhrase(token, phrase))) slangHit.add(token);
    }
  }

  // Longer lay phrases claim their words first, so "piso roto" beats "roto"
  // and "cuarto de baño" beats "cuarto".
  const taken = new Set<string>();
  let synonymOrder = 400;
  for (const entry of synonymPhrases) {
    const span = locatePhrase(stripped, phraseTokens, entry.phrase);
    if (!span || !spanIsFree(phraseTokens, span, taken)) continue;
    bumpSpecific(entry.tradeId, 2);
    for (const id of entry.related) bumpSpecific(id, 1);
    entry.jobs.forEach((id, index) => bumpJob(id, entry.score - index, synonymOrder + index));
    synonymOrder += entry.jobs.length + 1;
    consumeSpan(phraseTokens, span, taken);
  }

  const roomJobs: string[] = [];
  for (const entry of roomPhrases) {
    const span = locatePhrase(stripped, phraseTokens, entry.phrase);
    if (!span || !spanIsFree(phraseTokens, span, taken)) continue;
    for (const id of entry.room.trades) bumpRoom(id, 1);
    // A bathroom's Plumbing, a window's Handyman: this is a specific hit.
    for (const id of entry.room.strong ?? []) bumpSpecific(id, 2);
    for (const id of entry.room.jobs ?? []) if (!roomJobs.includes(id)) roomJobs.push(id);
    consumeSpan(phraseTokens, span, taken);
  }

  const freeTokens = tokens.filter((token) => !taken.has(token) && !slangHit.has(token));
  if (freeTokens.length > 0) {
    indexedJobs.forEach((job, index) => {
      const best = titleScore(freeTokens, job.tokens);
      if (best > 0) bumpJob(job.id, best, 1000 + index);
    });
  }

  let slangOrder = 0;
  for (const group of matchedGroups) {
    bumpSpecific(group.primaryTradeId, 2);
    for (const id of group.relatedTradeIds ?? []) bumpSpecific(id, 1);
    for (const id of group.primaryJobIds ?? []) bumpJob(id, 100, slangOrder++);
    for (const id of group.relatedJobIds ?? []) bumpJob(id, 50, slangOrder++);
  }

  if (jobScore.size === 0) {
    roomJobs.slice(0, 2).forEach((id, index) => bumpJob(id, 48 - index, 800 + index, true));
  }

  // "Kitchen floor" keeps Flooring and drops the kitchen list. "Restroom"
  // keeps Plumbing (the room's strong trade) and drops the other bath trades.
  // A room with no specific hit, such as "living room", keeps its soft list.
  const specificHit = specificLevel.size > 0;
  if (specificHit) {
    for (const id of roomJobIds) {
      const job = jobById.get(id);
      if (!job || !specificLevel.has(job.categoryId)) {
        jobScore.delete(id);
        jobOrder.delete(id);
      }
    }
  }

  const levelFor = (id: string) => Math.max(specificLevel.get(id) ?? 0, specificHit ? 0 : (roomLevel.get(id) ?? 0));
  const tradeCount = indexedTrades.filter((trade) => levelFor(trade.id) > 0).length;
  if (tradeCount === 0) {
    const ready = tokens.some((token) => token.length >= MIN_EMPTY);
    if (!ready) return idleResult(query);
    const trades = Object.fromEntries(indexedTrades.map((trade) => [trade.id, "dim" as const]));
    return { query, trades, chips: [], tradeCount: 0, jobCount: 0, status: "empty", empty: true };
  }

  const trades: Record<string, TradeVisual> = {};
  for (const trade of indexedTrades) {
    const level = levelFor(trade.id);
    trades[trade.id] = level >= 2 ? "strong" : level === 1 ? "soft" : "dim";
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
    status: "hit",
    empty: false
  };
}
