import { describe, it, expect } from "vitest";
import { config } from "../src/core/config/fixx.config";
import {
  addBusinessDays, addHours, buildSchedule, planAdditionalWork, bandFor, travelFeeFor, customerCancellation,
  computeHeld, refundDestination, isValidClabe, refundExpectedBy, priceBounds, isWithinLimits, clampPrice,
  emergencyTotal, issueWindow, rescheduleExpiry, caseResolutionDue, reviewDeadline, warrantyEndsAt, splitDepositBalance
} from "../src/core/rules";

const now = new Date("2026-10-06T16:00:00Z"); // Tuesday
const startIn = (h: number) => addHours(now, h);
const at = (h: number) => addHours(now, h).getTime();

describe("payment schedule: cash/SPEI tiers", () => {
  it("far (>48h): deposit in 24h, balance 24h before the job", () => {
    const s = buildSchedule({ method: "cash", total: 4200, jobStart: startIn(72), now });
    expect(s.tier).toBe("far");
    expect(s.installments[0]).toMatchObject({ kind: "deposit", amount: 840, onMissed: "expireBooking" });
    expect(s.installments[0]?.dueAt?.getTime()).toBe(at(24));
    expect(s.installments[1]).toMatchObject({ kind: "balance", amount: 3360, onMissed: "cancelJobRefundDeposit" });
    expect(s.installments[1]?.dueAt?.getTime()).toBe(at(48));
  });
  it("mid (24-48h): deposit and balance both due 24h before the job", () => {
    const s = buildSchedule({ method: "spei", total: 4200, jobStart: startIn(36), now });
    expect(s.tier).toBe("mid");
    s.installments.forEach((i) => expect(i.dueAt?.getTime()).toBe(at(12)));
  });
  it("boundaries (assumption G1): exactly 48h is mid, exactly 24h is mid and due now", () => {
    expect(buildSchedule({ method: "cash", total: 1000, jobStart: startIn(48), now }).tier).toBe("mid");
    const s = buildSchedule({ method: "cash", total: 1000, jobStart: startIn(24), now });
    expect(s.tier).toBe("mid");
    expect(s.installments[0]?.dueAt?.getTime()).toBe(now.getTime());
  });
  it("near (<24h): full amount due in 3h or the request expires", () => {
    const s = buildSchedule({ method: "cash", total: 4200, jobStart: startIn(23), now });
    expect(s.tier).toBe("near");
    expect(s.installments).toHaveLength(1);
    expect(s.installments[0]).toMatchObject({ kind: "full", amount: 4200, onMissed: "expireRequest" });
    expect(s.installments[0]?.dueAt?.getTime()).toBe(at(3));
  });
  it("recalculates from the new time after a reschedule", () => {
    const a = buildSchedule({ method: "cash", total: 4200, jobStart: startIn(72), now });
    const b = buildSchedule({ method: "cash", total: 4200, jobStart: startIn(120), now });
    expect(b.installments[1]?.dueAt?.getTime()).toBeGreaterThan(a.installments[1]?.dueAt?.getTime() ?? 0);
  });
});

describe("payment schedule: cards and wallets", () => {
  it("charges the deposit at acceptance and the balance at completion", () => {
    const s = buildSchedule({ method: "card", total: 4200, jobStart: startIn(10), now });
    expect(s.tier).toBe("card");
    expect(s.installments[0]).toMatchObject({ kind: "deposit", amount: 840, trigger: "quoteAccepted" });
    expect(s.installments[1]).toMatchObject({ kind: "balance", amount: 3360, trigger: "jobComplete", dueAt: null });
  });
  it("deposit + balance always equal the total", () => {
    const { deposit, balance } = splitDepositBalance(1001);
    expect(deposit).toBe(200.2); expect(balance).toBe(800.8);
  });
  it("rejects a non-positive total", () => {
    expect(() => buildSchedule({ method: "card", total: 0, jobStart: startIn(5), now })).toThrow();
  });
});

describe("additional work", () => {
  it("card: added to the balance, does not block completion", () => {
    expect(planAdditionalWork("card", 500)).toMatchObject({ addedToBalance: true, blocksCompletion: false, chargeTiming: "afterCompletion" });
  });
  it("cash/SPEI: reference payment that blocks completion", () => {
    expect(planAdditionalWork("cash", 500)).toMatchObject({ addedToBalance: false, blocksCompletion: true, chargeTiming: "byReference" });
  });
});

describe("travel fee and customer cancellation", () => {
  const zones = [{ id: "z1", adjacentTo: ["z2"] }, { id: "z2", adjacentTo: ["z1", "z3"] }, { id: "z3", adjacentTo: ["z2"] }];
  it("picks the band and fee", () => {
    expect(travelFeeFor(bandFor("z1", "z1", zones))).toBe(config.travelFeeBandsMXN.same);
    expect(travelFeeFor(bandFor("z1", "z2", zones))).toBe(config.travelFeeBandsMXN.adjacent);
    expect(travelFeeFor(bandFor("z1", "z3", zones))).toBe(config.travelFeeBandsMXN.far);
  });
  it("before on the way: free, full refund", () => {
    expect(customerCancellation({ stage: "beforeOnTheWay", paid: 840, travelFee: 150 }))
      .toMatchObject({ refund: 840, travelFeeCharged: 0, fullRefund: true, noRefund: false });
  });
  it("after on the way: refund minus the travel fee, professional gets the fee", () => {
    expect(customerCancellation({ stage: "afterOnTheWay", paid: 840, travelFee: 150 }))
      .toMatchObject({ refund: 690, travelFeeCharged: 150, toProfessional: 150 });
  });
  it("fee never exceeds what was paid; equal means no refund", () => {
    expect(customerCancellation({ stage: "afterOnTheWay", paid: 80, travelFee: 150 }))
      .toMatchObject({ refund: 0, travelFeeCharged: 80, noRefund: true });
    expect(customerCancellation({ stage: "afterOnTheWay", paid: 0, travelFee: 150 }).travelFeeCharged).toBe(0);
  });
});

describe("held amounts", () => {
  const lines = [{ id: "a", amount: 600 }, { id: "b", amount: 1400 }, { id: "c", amount: 2200 }];
  it("selected items: held is their cost, professional sees the net share", () => {
    expect(computeHeld({ lines, selected: ["b"], jobTotal: 4200, payoutRatio: 0.8 }))
      .toEqual({ held: 1400, heldPayout: 1120, released: 2800, wholeJob: false });
  });
  it("whole job holds the full amount", () => {
    expect(computeHeld({ lines, selected: "wholeJob", jobTotal: 4200, payoutRatio: 0.8 })).toMatchObject({ held: 4200, released: 0, wholeJob: true });
  });
  it("an unitemized quote holds the full amount", () => {
    expect(computeHeld({ lines: [], selected: [], jobTotal: 4200, payoutRatio: 0.8 }).held).toBe(4200);
  });
  it("rejects unknown lines", () => {
    expect(() => computeHeld({ lines, selected: ["zzz"], jobTotal: 4200, payoutRatio: 0.8 })).toThrow();
  });
});

describe("refunds and business days", () => {
  it("routes by payment method", () => {
    expect(refundDestination("card")).toBe("original");
    expect(refundDestination("wallet")).toBe("original");
    expect(refundDestination("cash")).toBe("clabe");
    expect(refundDestination("spei")).toBe("clabe");
  });
  it("validates a CLABE as 18 digits", () => {
    expect(isValidClabe("012345678901234567")).toBe(true);
    expect(isValidClabe("0123 4567 8901 2345 67")).toBe(true);
    expect(isValidClabe("12345")).toBe(false);
    expect(isValidClabe("01234567890123456X")).toBe(false);
  });
  it("refunds arrive within 3 business days", () => {
    expect(refundExpectedBy(new Date("2026-10-09T12:00:00Z")).toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });
  it("skips weekends and Mexican holidays", () => {
    expect(addBusinessDays(new Date("2026-11-13T12:00:00Z"), 1).toISOString()).toBe("2026-11-17T12:00:00.000Z"); // Mon 16 Nov is a holiday
  });
  it("case resolution is 5 business days", () => {
    expect(caseResolutionDue(new Date("2026-10-06T16:00:00Z")).toISOString()).toBe("2026-10-13T16:00:00.000Z");
  });
});

describe("pricing, deadlines, warranty", () => {
  it("keeps the professional's price within the limits", () => {
    expect(priceBounds(4000, 15)).toEqual({ min: 3400, max: 4600 });
    expect(isWithinLimits(4000, 4600, 15)).toBe(true);
    expect(isWithinLimits(4000, 4601, 15)).toBe(false);
    expect(clampPrice(4000, 5000, 15)).toBe(4600);
  });
  it("does not add a flat urgent fee on top of the quote", () => {
    expect(emergencyTotal(4000)).toBe(4000);
  });
  it("issue window is 24h with a reminder 6h before it closes", () => {
    const w = issueWindow(now);
    expect(w.endsAt.getTime()).toBe(at(24));
    expect(w.reminderAt.getTime()).toBe(at(18));
  });
  it("reschedule requests expire after 12h; case review deadline is 14 days", () => {
    expect(rescheduleExpiry(now).getTime()).toBe(at(12));
    expect(reviewDeadline(now).getTime()).toBe(now.getTime() + 14 * 86_400_000);
  });
  it("warranty length comes from config, not a hard-coded number", () => {
    expect(warrantyEndsAt(now, "painting").getTime()).toBe(now.getTime() + config.warrantyDaysByCategory["painting"]! * 86_400_000);
    const custom = { ...config, warrantyDaysByCategory: { painting: 45 } };
    expect(warrantyEndsAt(now, "painting", custom).getTime()).toBe(now.getTime() + 45 * 86_400_000);
    expect(() => warrantyEndsAt(now, "unknown")).toThrow();
  });
});
