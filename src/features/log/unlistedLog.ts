import type { Lang } from "@/core/config/fixx.config";
import type { SearchResult } from "@/features/customer/searchIndex";

/** Column order Scout reads. Do not reorder. */
export const UNLISTED_COLUMNS = [
  "date",
  "source",
  "query_text",
  "language",
  "matched_trade",
  "item_or_job_description",
  "agent_priced_amount",
  "review_status"
] as const;

export const UNLISTED_CSV_HEADER = UNLISTED_COLUMNS.join(",");

export type UnlistedSource = "off-catalog" | "agent-review" | "search-miss";
export type UnlistedLanguage = Lang;
export type UnlistedReviewStatus = "pending-review" | "approved" | "declined" | "";

export interface UnlistedRow {
  date: string;
  source: UnlistedSource;
  query_text: string;
  language: UnlistedLanguage;
  matched_trade: string;
  item_or_job_description: string;
  /** Customer price in MXN with centavos, or blank. Never a payout or a margin. */
  agent_priced_amount: string;
  review_status: UnlistedReviewStatus;
}

const STORAGE_KEY = "fixx.unlistedLog";

let memory: UnlistedRow[] = [];

function storage(): Storage | null {
  try {
    const store = globalThis.localStorage;
    if (!store) return null;
    const probe = `${STORAGE_KEY}.probe`;
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

/** ISO 8601 in America/Mexico_City, including the offset. */
export function mexicoCityTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  const wall = `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}:${pick("second")}`;
  const offsetMin = Math.round((Date.parse(`${wall}Z`) - now.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${wall}${sign}${hh}:${mm}`;
}

/** MXN with centavos. Blank when there is no customer price. */
export function formatPricedAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/** RFC 4180 field quoting. */
export function quoteCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function rowsToCsv(rows: readonly UnlistedRow[]): string {
  const lines = [
    UNLISTED_CSV_HEADER,
    ...rows.map((row) => UNLISTED_COLUMNS.map((column) => quoteCsvField(row[column])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

export function readUnlistedLog(): UnlistedRow[] {
  const store = storage();
  if (!store) return memory.map((row) => ({ ...row }));
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UnlistedRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearUnlistedLog(): void {
  memory = [];
  storage()?.removeItem(STORAGE_KEY);
}

function writeRows(rows: UnlistedRow[]): void {
  memory = rows;
  storage()?.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function appendUnlistedRow(row: Omit<UnlistedRow, "date">, now: Date = new Date()): UnlistedRow {
  const next: UnlistedRow = { ...row, date: mexicoCityTimestamp(now) };
  writeRows([...readUnlistedLog(), next]);
  return next;
}

/**
 * Trades glowing strong or soft when the search found no catalog job.
 * Idle, empty, and safety results are not misses.
 */
export function searchMissTrades(result: SearchResult): string[] {
  if (!result.query.trim() || result.status === "idle" || result.status === "safety" || result.status === "empty") return [];
  if (result.chips.length > 0) return [];
  return Object.entries(result.trades)
    .filter(([, tier]) => tier === "strong" || tier === "soft")
    .map(([id]) => id)
    .sort();
}

/** Log a settled search that matched a trade and no job. Repeating the same query does not add another row. */
export function recordSearchResult(result: SearchResult, language: UnlistedLanguage, queryText: string = result.query, now?: Date): void {
  const trades = searchMissTrades(result);
  const text = queryText.trim();
  if (trades.length === 0 || !text) return;
  const matched = trades.join("|");
  const last = readUnlistedLog().at(-1);
  if (last?.source === "search-miss" && last.query_text === text && last.language === language && last.matched_trade === matched) return;
  appendUnlistedRow({
    source: "search-miss",
    query_text: text,
    language,
    matched_trade: matched,
    item_or_job_description: "",
    agent_priced_amount: "",
    review_status: ""
  }, now);
}

/** A regulated job was sent and the customer sees Pending review. The amount is the customer price. */
export function logAgentReview(input: {
  queryText: string;
  language: UnlistedLanguage;
  matchedTrade: string;
  description: string;
  amount: number | null;
}, now?: Date): UnlistedRow {
  return appendUnlistedRow({
    source: "agent-review",
    query_text: input.queryText,
    language: input.language,
    matched_trade: input.matchedTrade,
    item_or_job_description: input.description,
    agent_priced_amount: formatPricedAmount(input.amount),
    review_status: "pending-review"
  }, now);
}

/**
 * Off-catalog item the pricing queue will record later.
 * Nothing in the app calls this yet.
 */
export function logOffCatalogItem(input: {
  queryText: string;
  language: UnlistedLanguage;
  matchedTrade?: string;
  description: string;
  amount?: number | null;
  reviewStatus?: UnlistedReviewStatus;
}, now?: Date): UnlistedRow {
  return appendUnlistedRow({
    source: "off-catalog",
    query_text: input.queryText,
    language: input.language,
    matched_trade: input.matchedTrade ?? "",
    item_or_job_description: input.description,
    agent_priced_amount: formatPricedAmount(input.amount),
    review_status: input.reviewStatus ?? "pending-review"
  }, now);
}

/** Download the browser log. Header only when the visitor has no rows yet. */
export function downloadUnlistedLog(): void {
  const csv = rowsToCsv(readUnlistedLog());
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "unlisted_log.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
