import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast } from "../src/core/rules/contrast";
import { colors, GLASS_ALPHA, GLASS_LIME_ALPHA, GLASS_SHEET_ALPHA, rgbaFrom, rgbChannels } from "../src/ui/tokens";

const SRC = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

/** Patterns that put pure white back into styles. */
const WHITE = [
  /#fff(?:fff)?\b/i,
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|caret|accent|decoration|shadow)-white\b/,
  /rgba?\(\s*255\s*,\s*255\s*,\s*255\b/,
  /(['"`])white\1/
];

function composite(topHex: string, alpha: number, bottomHex: string): string {
  const top = rgbChannels(topHex);
  const bottom = rgbChannels(bottomHex);
  const channels = top.map((channel, i) => Math.round(channel * alpha + bottom[i]! * (1 - alpha)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

describe("palette stays off pure white", () => {
  it("fails when a style reintroduces pure white", () => {
    const hits: string[] = [];
    for (const path of files(SRC)) {
      const src = readFileSync(path, "utf8");
      for (const pattern of WHITE) {
        if (pattern.test(src)) hits.push(`${path.replace(process.cwd() + "/", "")} matches ${pattern}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("uses the lightest grey as the surface, and keeps it greyscale", () => {
    expect(colors.paper).toBe("#F5F5F5");
    expect(colors.paper).not.toBe("#FFFFFF");
    const paper = rgbChannels(colors.paper);
    const mist = rgbChannels(colors.mist);
    expect(paper[0]).toBe(paper[1]);
    expect(paper[1]).toBe(paper[2]);
    expect(paper[0]).toBeGreaterThan(mist[0]!);
    expect(paper[0]).toBeLessThan(255);
  });
});

describe("liquid glass stays readable", () => {
  const css = readFileSync(join(SRC, "app/index.css"), "utf8");
  const fill = rgbaFrom(colors.paper, GLASS_ALPHA);
  const lime = rgbaFrom(colors.accent, GLASS_LIME_ALPHA);

  it("blurs and saturates, with a solid fallback and a reduced-transparency path", () => {
    expect(css).toContain(fill);
    expect(css).toContain(".glass-sheet");
    expect(css).toContain(lime);
    expect(css).toContain("-webkit-backdrop-filter: blur(18px) saturate(1.35)");
    expect(css).toContain("backdrop-filter: blur(18px) saturate(1.35)");
    expect(css).toContain("-webkit-backdrop-filter: blur(18px) saturate(1.45)");
    expect(css).toContain("@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))");
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toContain('background-color: theme("colors.paper")');
    expect(css).toContain('background-color: theme("colors.accent")');
  });

  it("keeps ink and secondary text at WCAG AA on the glass, including over the darkest wash", () => {
    for (const behind of [colors.mist, colors.panel, colors.line]) {
      const grey = composite(colors.paper, GLASS_ALPHA, behind);
      const tinted = composite(colors.accent, GLASS_LIME_ALPHA, behind);
      expect(contrast(colors.ink, grey)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.inkSoft, grey)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.ink, tinted)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.inkSoft, tinted)).toBeGreaterThanOrEqual(4.5);
    }
    const sheet = composite(colors.paper, GLASS_SHEET_ALPHA, colors.accent);
    expect(contrast(colors.ink, sheet)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.inkSoft, sheet)).toBeGreaterThanOrEqual(4.5);
  });
});
