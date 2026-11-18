import { describe, expect, it } from "vitest";
import { roundMoney } from "../src/config/revenue";
import { config } from "../src/core/config/fixx.config";
import { addToHold, bookingHold, buildSchedule, customerAmountFromPayout, splitDepositBalance } from "../src/core/rules";
import { addHours } from "../src/core/rules";

const now = new Date("2026-10-06T16:00:00Z");

describe("full booking hold", () => {
  it("holds the whole quoted price at booking and leaves a hook for later increases", () => {
    expect(config.deposit.sharePct).toBe(100);
    const split = splitDepositBalance(4200);
    expect(split.deposit).toBe(4200);
    expect(split.balance).toBe(0);
    expect(split.deposit + split.balance).toBe(4200);

    const hold = bookingHold(1001.005);
    expect(hold.quoted).toBe(1001.01);
    expect(hold.increases).toEqual([]);
    expect(hold.held).toBe(1001.01);
    const raised = addToHold(hold, 50.125);
    expect(raised.increases).toEqual([50.13]);
    expect(raised.held).toBe(roundMoney(1001.01 + 50.13));
    expect(() => addToHold(hold, 0)).toThrow();
  });

  it("charges that hold once, with no later balance installment", () => {
    const card = buildSchedule({ method: "card", total: 4200.1, jobStart: addHours(now, 72), now });
    expect(card.installments).toEqual([
      expect.objectContaining({ kind: "deposit", amount: 4200.1, trigger: "quoteAccepted" })
    ]);
    const cash = buildSchedule({ method: "cash", total: 4200, jobStart: addHours(now, 72), now });
    expect(cash.installments.map((item) => item.kind)).toEqual(["deposit"]);
    expect(cash.installments[0]?.amount).toBe(4200);
  });
});

describe("centavo rounding", () => {
  it("turns a typed payout into a customer amount half-up to the centavo", () => {
    expect(customerAmountFromPayout(196.84, 0.8)).toBe(roundMoney(196.84 / 0.8));
    expect(customerAmountFromPayout(196.84, 0.8)).toBe(246.05);
    expect(customerAmountFromPayout(196.84, 0.8)).not.toBe(Math.round(196.84 / 0.8 / 10) * 10);
    expect(customerAmountFromPayout(10.005, 1)).toBe(10.01);
    expect(() => customerAmountFromPayout(10, 0)).toThrow();
  });
});
