import { describe, expect, it } from "vitest";
import { addHours } from "../src/core/rules/time";
import {
  declineChargeCap,
  EXTRA_WORK,
  increaseSplit,
  isProposalExpired,
  proposalReminders,
  routeExtraWork
} from "../src/core/pricing/extraWork";

const original = 1450;

describe("extra work routing", () => {
  it("sends a combined increase within 25% to the customer, and close starts at 20%", () => {
    const within = routeExtraWork({ originalNte: original, priorApproved: 0, increase: 228.9 });
    expect(within.requiresAgentReview).toBe(false);
    expect(within.level).toBe("within");

    const close = routeExtraWork({ originalNte: original, priorApproved: 0, increase: 228.9, delivery: EXTRA_WORK.deliveryMxn.moto });
    expect(close.combined).toBe(348.9);
    expect(close.requiresAgentReview).toBe(false);
    expect(close.level).toBe("close");
    expect(close.pct).toBeGreaterThanOrEqual(20);
    expect(close.pct).toBeLessThanOrEqual(25);
  });

  it("sends over 25%, unlisted, regulated, safety, and a new delivery trip to an agent", () => {
    expect(routeExtraWork({ originalNte: original, priorApproved: 100, increase: 330 }).requiresAgentReview).toBe(true);
    expect(routeExtraWork({ originalNte: original, priorApproved: 0, increase: 100, isUnlisted: true }).reasons).toContain("unlisted");
    expect(routeExtraWork({ originalNte: original, priorApproved: 0, increase: 10, regulated: true }).level).toBe("review");
    expect(routeExtraWork({ originalNte: original, priorApproved: 0, increase: 10, safety: true }).requiresAgentReview).toBe(true);
    const trip = routeExtraWork({ originalNte: original, priorApproved: 0, increase: 50, newDeliveryTrip: true, delivery: EXTRA_WORK.deliveryMxn.van });
    expect(trip.reasons).toEqual(expect.arrayContaining(["new-delivery", "over-25"]));
    expect(routeExtraWork({ originalNte: original, priorApproved: 0, increase: 10, differentTrade: true }).level).toBe("new-work-order");
  });

  it("splits an increase 20/80 and rounds the upfront share up", () => {
    expect(increaseSplit(100)).toEqual({ total: 100, deposit: 20, balance: 80 });
    const awkward = increaseSplit(10.03);
    expect(awkward.deposit).toBe(2.01);
    expect(awkward.balance).toBe(8.02);
    expect(awkward.deposit + awkward.balance).toBe(10.03);
  });

  it("reminds once a day and expires after 72 hours, unless the clock is paused", () => {
    const sent = new Date("2026-11-18T15:00:00Z");
    const reminders = proposalReminders(sent);
    expect(reminders.map((date) => date.toISOString())).toEqual([
      addHours(sent, 24).toISOString(),
      addHours(sent, 48).toISOString()
    ]);
    expect(isProposalExpired(sent, addHours(sent, 71), null, 0)).toBe(false);
    expect(isProposalExpired(sent, addHours(sent, 72), null, 0)).toBe(true);
    expect(isProposalExpired(sent, addHours(sent, 80), addHours(sent, 40), 0)).toBe(false);
  });

  it("caps a decline charge at the original not-to-exceed price", () => {
    expect(declineChargeCap(1450, 900.004)).toBe(900.01);
    expect(declineChargeCap(1450, 1600)).toBe(1450);
  });
});
