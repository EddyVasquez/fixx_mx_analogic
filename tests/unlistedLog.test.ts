import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { searchServices } from "../src/features/customer/searchIndex";
import {
  UNLISTED_COLUMNS,
  UNLISTED_CSV_HEADER,
  clearUnlistedLog,
  formatPricedAmount,
  logAgentReview,
  logOffCatalogItem,
  mexicoCityTimestamp,
  quoteCsvField,
  readUnlistedLog,
  recordSearchResult,
  rowsToCsv,
  searchMissTrades
} from "../src/features/log/unlistedLog";

const when = new Date("2026-11-18T21:30:00Z");

describe("unlisted log", () => {
  beforeEach(() => clearUnlistedLog());

  it("keeps the committed header, in order, and nothing else", () => {
    const file = readFileSync(join(process.cwd(), "data/unlisted_log.csv"), "utf8");
    expect(file).toBe(`${UNLISTED_CSV_HEADER}\n`);
    expect(UNLISTED_COLUMNS).toEqual([
      "date",
      "source",
      "query_text",
      "language",
      "matched_trade",
      "item_or_job_description",
      "agent_priced_amount",
      "review_status"
    ]);
  });

  it("quotes commas, quotes, and Korean text, and writes centavos", () => {
    expect(mexicoCityTimestamp(when)).toBe("2026-11-18T15:30:00-06:00");
    expect(formatPricedAmount(10)).toBe("10.00");
    expect(formatPricedAmount(1234.5)).toBe("1234.50");
    expect(formatPricedAmount(null)).toBe("");
    expect(quoteCsvField("hello, world")).toBe(`"hello, world"`);
    expect(quoteCsvField(`변기, "막힘"`)).toBe(`"변기, ""막힘"""`);

    logOffCatalogItem({
      queryText: `변기, "막힘"`,
      language: "ko",
      description: "hello, world",
      amount: 1234.5
    }, when);
    const csv = rowsToCsv(readUnlistedLog());
    expect(csv.startsWith(`${UNLISTED_CSV_HEADER}\n`)).toBe(true);
    expect(csv).toContain(`"변기, ""막힘"""`);
    expect(csv).toContain(`"hello, world"`);
    expect(csv).toContain("1234.50");
    expect(csv).not.toMatch(/payout|commission|margin/i);
  });

  it("logs a trade match with no job, and skips a normal match and an idle query", () => {
    const miss = searchServices("plumbing", "en");
    expect(miss.trades.plumbing).toBe("strong");
    expect(miss.chips).toEqual([]);
    expect(searchMissTrades(miss)).toEqual(["plumbing"]);
    recordSearchResult(miss, "en", "plumbing", when);
    recordSearchResult(miss, "en", "plumbing", when);
    expect(readUnlistedLog()).toHaveLength(1);
    expect(readUnlistedLog()[0]).toMatchObject({
      date: "2026-11-18T15:30:00-06:00",
      source: "search-miss",
      query_text: "plumbing",
      language: "en",
      matched_trade: "plumbing",
      agent_priced_amount: "",
      review_status: ""
    });

    const hit = searchServices("toilet", "en");
    expect(hit.chips.length).toBeGreaterThan(0);
    recordSearchResult(hit, "en", "toilet", when);
    const idle = searchServices("  ", "en");
    expect(idle.status).toBe("idle");
    recordSearchResult(idle, "en", "  ", when);
    expect(readUnlistedLog()).toHaveLength(1);
  });

  it("records an off-catalog item and a pending review without a payout", () => {
    const off = logOffCatalogItem({
      queryText: "custom valve",
      language: "es",
      matchedTrade: "plumbing",
      description: "válvula que no está en el catálogo",
      amount: 80
    }, when);
    expect(off.source).toBe("off-catalog");
    expect(off.agent_priced_amount).toBe("80.00");
    expect(off.review_status).toBe("pending-review");

    const review = logAgentReview({
      queryText: "gas line",
      language: "en",
      matchedTrade: "plumbing",
      description: "FIXX-PLM-004",
      amount: 1500.4
    }, when);
    expect(review.review_status).toBe("pending-review");
    expect(review.agent_priced_amount).toBe("1500.40");
    expect(Object.keys(review).sort()).toEqual([...UNLISTED_COLUMNS].sort());
  });
});
