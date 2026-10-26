import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSeed } from "../src/mocks/db/seedData";

const TRADES = ["plumbing", "electrical", "hvac", "painting", "pest_control", "gardening", "flooring", "concrete", "carpentry", "appliance", "roofing", "handyman", "locksmith", "cleaning"];

describe("seed data", () => {
  const s = loadSeed();
  it("has all 14 trades, with English, Spanish and Korean names from the workbook categories", () => {
    expect(s.categories.map((c) => c.id)).toEqual(TRADES);
    s.categories.forEach((c) => Object.values(c.names).forEach((n) => expect(n.length).toBeGreaterThan(0)));
    const catalog = JSON.parse(readFileSync(join(process.cwd(), "src/seed/pricing/catalog.json"), "utf8")) as { tasks: Record<string, { category: string }> };
    const fromBook = new Set(Object.values(catalog.tasks).map((t) => t.category));
    expect(new Set(s.categories.map((c) => c.catalogCategory))).toEqual(fromBook);
  });
  it("has an approved professional for every trade", () => {
    for (const id of TRADES) {
      expect(s.professionals.some((p) => p.verification === "approved" && p.trades.includes(id))).toBe(true);
    }
  });
  it("has 6-8 professionals, mixing Korean- and Spanish-speaking", () => {
    expect(s.professionals.length).toBeGreaterThanOrEqual(6);
    expect(s.professionals.length).toBeLessThanOrEqual(8);
    expect(s.professionals.some((p) => p.languages[0] === "ko")).toBe(true);
    expect(s.professionals.some((p) => p.languages.length === 1 && p.languages[0] === "es")).toBe(true);
    expect(s.professionals.some((p) => p.verification === "pending")).toBe(true); // scenario 11
  });
  it("has customers in all three languages", () => {
    const langs = new Set(s.users.filter((u) => u.role === "customer").map((u) => u.language));
    expect(langs).toEqual(new Set(["en", "es", "ko"]));
  });
  it("has unique ids and valid references", () => {
    const ids = [...s.users, ...s.professionals, ...s.homes, ...s.zones, ...s.categories].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const zoneIds = new Set(s.zones.map((z) => z.id)), userIds = new Set(s.users.map((u) => u.id)), cat = new Set(s.categories.map((c) => c.id));
    s.professionals.forEach((p) => { expect(zoneIds.has(p.zoneId)).toBe(true); expect(userIds.has(p.userId)).toBe(true); p.trades.forEach((t) => expect(cat.has(t)).toBe(true)); });
    s.homes.forEach((h) => { expect(zoneIds.has(h.zoneId)).toBe(true); expect(userIds.has(h.userId)).toBe(true); });
  });
  it("has symmetric zone adjacency", () => {
    s.zones.forEach((z) => z.adjacentTo.forEach((a) => expect(s.zones.find((x) => x.id === a)?.adjacentTo).toContain(z.id)));
  });
});
