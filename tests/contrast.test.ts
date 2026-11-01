import { describe, it, expect } from "vitest";
import { colors, darkColors, darkTextPairs, textPairs } from "../src/ui/tokens";
import { contrast } from "../src/core/rules/contrast";

describe("design token contrast (WCAG AA 4.5:1)", () => {
  it("keeps the hub accent on the chosen lime", () => {
    expect(colors.accent).toBe("#DFFF32");
  });

  for (const [name, fg, bg] of textPairs) {
    it(name, () => expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5));
  }
  describe("dark theme", () => {
    for (const [name, fg, bg] of darkTextPairs) {
      it(name, () => expect(contrast(darkColors[fg], darkColors[bg])).toBeGreaterThanOrEqual(4.5));
    }
    it("keeps charcoal readable on the lime continue button and selected chips", () => {
      expect(contrast("#2E2E2E", "#DFFF32")).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#E0E0E0", "#1E1E1E")).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#E0E0E0", "#2E2E2E")).toBeGreaterThanOrEqual(4.5);
    });
  });
  it("every token is a neutral grey (current direction)", () => {
    for (const [key, hex] of Object.entries(colors)) {
      if (key.startsWith("warnAmber") || key === "accent") continue;
      const n = parseInt(hex.slice(1), 16);
      expect(((n >> 16) & 255) === ((n >> 8) & 255) && ((n >> 8) & 255) === (n & 255)).toBe(true);
    }
  });
});
