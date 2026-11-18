import { describe, expect, it } from "vitest";
import { config } from "../src/core/config/fixx.config";
import { addHours, addToHold, bookingHold, buildSchedule, ceilToCentavo, customerAmountFromPayout, splitDepositBalance } from "../src/core/rules";

const now = new Date("2026-10-06T16:00:00Z");

describe("20/80 deposit and balance", () => {
  it("keeps the original split and makes the parts add up after rounding the deposit up", () => {
    expect(config.deposit.sharePct).toBe(20);
    const even = splitDepositBalance(4200);
    expect(even).toEqual({ total: 4200, deposit: 840, balance: 3360 });
    expect(even.deposit + even.balance).toBe(even.total);

    const awkward = splitDepositBalance(10.03);
    expect(awkward.deposit).toBe(2.01);
    expect(awkward.balance).toBe(8.02);
    expect(awkward.deposit + awkward.balance).toBe(10.03);

    const card = buildSchedule({ method: "card", total: 4200, jobStart: addHours(now, 72), now });
    expect(card.installments[0]).toMatchObject({ kind: "deposit", amount: 840, trigger: "quoteAccepted" });
    expect(card.installments[1]).toMatchObject({ kind: "balance", amount: 3360, trigger: "jobComplete" });
  });

  it("splits a $100 approved increase 20/80 and adds the full $100 to the total", () => {
    const hold = bookingHold(4200);
    const next = addToHold(hold, 100);
    expect(next.increases).toEqual([{ total: 100, upfront: 20, balance: 80 }]);
    expect(next.total).toBe(4300);
    expect(next.upfront).toBe(860);
    expect(next.balance).toBe(3440);
    expect(next.upfront + next.balance).toBe(next.total);
    expect(() => addToHold(hold, 0)).toThrow();
  });
});

describe("centavo rounding", () => {
  it("always rounds up to the next centavo", () => {
    expect(ceilToCentavo(1234.561)).toBe(1234.57);
    expect(ceilToCentavo(1234.56)).toBe(1234.56);
    expect(ceilToCentavo(887.5)).toBe(887.5);
    expect(ceilToCentavo(887.5000004)).toBe(887.5);
    expect(customerAmountFromPayout(1234.561, 1)).toBe(1234.57);
    expect(customerAmountFromPayout(196.84, 0.8)).toBe(246.05);
    expect(customerAmountFromPayout(196.84, 0.8)).not.toBe(Math.round(196.84 / 0.8 / 10) * 10);
    expect(() => customerAmountFromPayout(10, 0)).toThrow();
  });
});
