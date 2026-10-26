import { describe, it, expect } from "vitest";
import { colors, textPairs } from "../src/ui/tokens";
import { contrast } from "../src/core/rules/contrast";

describe("design token contrast (WCAG AA 4.5:1)", () => {
  for (const [name, fg, bg] of textPairs) {
    it(name, () => expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5));
  }
  it("every token is a neutral grey (current direction)", () => {
    for (const [key, hex] of Object.entries(colors)) {
      if (key.startsWith("warnAmber")) continue;
      const n = parseInt(hex.slice(1), 16);
      expect(((n >> 16) & 255) === ((n >> 8) & 255) && ((n >> 8) & 255) === (n & 255)).toBe(true);
    }
  });
});
