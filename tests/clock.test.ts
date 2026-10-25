import { describe, it, expect } from "vitest";
import { Clock } from "../src/core/clock/clock";

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
