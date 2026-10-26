import { describe, it, expect } from "vitest";
import { Clock, formatMXN } from "../src/core/clock/clock";

describe("Clock", () => {
  it("fast-forwards deterministically", () => {
    const c = new Clock(0, () => 1_000_000);
    c.advanceHours(24);
    expect(c.now().getTime()).toBe(1_000_000 + 86_400_000);
  });
  it("notifies subscribers and resets", () => {
    const c = new Clock(0, () => 0);
    let calls = 0; c.subscribe(() => calls++);
    c.advanceHours(1); c.reset();
    expect(calls).toBe(2); expect(c.getOffset()).toBe(0);
  });
});

describe("formatMXN", () => {
  it("prints the same pesos and centavos in every language", () => {
    for (const locale of ["en-US", "es-MX", "ko-KR"]) {
      expect(formatMXN(450, locale)).toBe("$450.00 MXN");
      expect(formatMXN(1250, locale)).toBe("$1,250.00 MXN");
    }
  });
});
