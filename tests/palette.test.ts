import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colors } from "../src/ui/tokens";

/** Approved hues. Everything else in the token set is a neutral grey. Avatar fills are badge-only. */
export const PALETTE_HUE_ALLOWLIST = new Set(["accent", "avatarLime", "avatarPink", "warnAmberBg", "warnAmberInk"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx|css|html)$/.test(name) ? [path] : [];
  });
}

function channels(raw: string): [number, number, number] | null {
  let hex = raw.slice(1);
  if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split("").map((c) => c + c).join("");
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6) return null;
  const n = Number.parseInt(hex, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

describe("palette", () => {
  it("keeps paper as the lightest grey", () => {
    expect(colors.paper).toBe("#F5F5F5");
    const [r, g, b] = channels(colors.paper)!;
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeLessThanOrEqual(0xf5);
  });

  it("names the avatar badge colors and keeps them off the grey list", () => {
    expect(colors.avatarLime).toBe("#DFFF32");
    expect(colors.avatarPink).toBe("#FF9FD8");
    expect(colors.accent).toBe("#DFFF32");
    expect(PALETTE_HUE_ALLOWLIST.has("avatarLime")).toBe(true);
    expect(PALETTE_HUE_ALLOWLIST.has("avatarPink")).toBe(true);
    for (const [key, hex] of Object.entries(colors)) {
      if (PALETTE_HUE_ALLOWLIST.has(key)) continue;
      const [r, g, b] = channels(hex)!;
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("uses avatar hues only on the badge component", () => {
    const mentions = walk("src").filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes("avatarLime") || text.includes("avatarPink");
    });
    expect(mentions.map((file) => file.replaceAll("\\", "/")).sort()).toEqual([
      "src/features/customer/avatars.tsx",
      "src/ui/tokens.ts"
    ]);
  });

  it("has no white in the app source", () => {
    const hits: string[] = [];
    const files = walk("src").concat(["vite.config.ts", "index.html"]);
    const white = /#(?:fff|ffffff)\b|bg-white|text-white|border-white|fill-white|\bwhite\b/i;
    const hex = /#[0-9a-fA-F]{3,8}/g;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (white.test(text)) hits.push(`${file}: white`);
      for (const match of text.matchAll(hex)) {
        const rgb = channels(match[0]);
        if (rgb && rgb.every((channel) => channel > 0xf5)) hits.push(`${file}: ${match[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
