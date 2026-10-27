import { describe, it, expect } from "vitest";
import catalogJson from "../src/seed/pricing/catalog.json";
import { materialsPrice } from "../src/config/revenue";
import { EXTRA_COPPER_LINE, MINISPLIT_TASK, extraCopperItemId, extraCopperPrice } from "../src/core/pricing/extraCopper";
import { customerLines } from "../src/core/pricing/quote";
import { quoteTask, type Catalog } from "../src/core/pricing/instantQuote";
import { addHours } from "../src/core/rules";
import { createSnapshot, jobMachine, newJobCtx, send, type JobCtx, type JobEvent, type JobState, type Snapshot } from "../src/core/machines";

const cat = catalogJson as unknown as Catalog;
const t0 = new Date("2026-10-06T16:00:00Z");
const at = (h: number) => addHours(t0, h);
type JS = Snapshot<JobState, JobCtx>;

function run(snap: JS, ...events: [JobEvent, Date?][]): JS {
  let s = snap;
  for (const [e, when] of events) {
    const r = send(jobMachine, s, e, when ?? t0);
    if (!r.ok) throw new Error(`${e.type}: ${r.error}`);
    s = r.snapshot;
  }
  return s;
}

function installInProgress(tier: string): JS {
  const quote = quoteTask(cat, { taskId: MINISPLIT_TASK, tier, urgency: "STANDARD" });
  const lines = customerLines({ materials: quote.materials, labor: quote.labor, bookingFee: quote.bookingFee });
  const quoted = run(createSnapshot(jobMachine, newJobCtx()),
    [{ type: "ESTIMATE_READY" }], [{ type: "RECOMMENDATIONS_READY" }],
    [{ type: "SELECT_PROFESSIONAL", professionalId: "p1" }],
    [{ type: "SEND_QUOTE", total: quote.total, travelFee: 150, payoutRatio: 0.8, lines, taskId: quote.taskId, tier: quote.tier }]);
  const accepted = run(quoted, [{ type: "ACCEPT_QUOTE", method: "card", jobStart: at(72) }]);
  const scheduled = run(accepted, [{ type: "PAYMENT_SATISFIED", amount: accepted.ctx.initialDue }]);
  return run(scheduled, [{ type: "ON_THE_WAY" }, at(72)], [{ type: "CHECK_IN" }], [{ type: "START_WORK" }]);
}

describe("extra copper meters on a minisplit install", () => {
  it("uses M16 for 1 t and 1.5 t, and M17 for 2 t and 3 t", () => {
    expect(extraCopperItemId("1 t")).toBe("HVC-M16");
    expect(extraCopperItemId("1.5 t")).toBe("HVC-M16");
    expect(extraCopperItemId("2 t")).toBe("HVC-M17");
    expect(extraCopperItemId("3 t")).toBe("HVC-M17");
    expect(cat.items["HVC-M16"]!.price).toBe(196.84);
    expect(cat.items["HVC-M17"]!.price).toBe(351.18);
  });

  it("prices extra metres with the materials markup and the card-fee gross-up, once", () => {
    expect(extraCopperPrice(MINISPLIT_TASK, "1 t", 1)).toBe(materialsPrice(196.84));
    expect(extraCopperPrice(MINISPLIT_TASK, "1 t", 1)).toBe(215.69);
    expect(extraCopperPrice(MINISPLIT_TASK, "1.5 t", 2)).toBe(materialsPrice(196.84 * 2));
    expect(extraCopperPrice(MINISPLIT_TASK, "2 t", 1)).toBe(materialsPrice(351.18));
    expect(extraCopperPrice(MINISPLIT_TASK, "2 t", 1)).toBe(384.81);
    expect(extraCopperPrice(MINISPLIT_TASK, "3 t", 2)).toBe(materialsPrice(351.18 * 2));
    expect(extraCopperPrice(MINISPLIT_TASK, "3 t", 2)).toBe(769.62);
    const oldInversion = Math.round(196.84 / 0.8 / 10) * 10;
    expect(extraCopperPrice(MINISPLIT_TASK, "1 t", 1)).not.toBe(oldInversion);
  });

  it("does not price other tasks, a missing tier, or zero metres", () => {
    expect(extraCopperPrice("FIXX-HVC-002", "3 t", 4)).toBeNull();
    expect(extraCopperPrice(MINISPLIT_TASK, "Standard", 1)).toBeNull();
    expect(extraCopperPrice(MINISPLIT_TASK, "1 t", 0)).toBeNull();
    expect(extraCopperPrice(MINISPLIT_TASK, "1 t", -2)).toBeNull();
  });

  it("stores the task on the quote, then adds the copper line only after the customer approves", () => {
    const working = installInProgress("1 t");
    expect(working.ctx.taskId).toBe(MINISPLIT_TASK);
    expect(working.ctx.tier).toBe("1 t");
    const price = extraCopperPrice(MINISPLIT_TASK, "1 t", 3)!;
    expect(price).toBe(materialsPrice(196.84 * 3));
    const labor = working.ctx.lines.find((l) => l.id === "work")!.amount;

    const pending = run(working, [{ type: "REQUEST_ADDITIONAL_WORK", amount: price, lineId: EXTRA_COPPER_LINE, meters: 3 }]);
    expect(pending.state).toBe("additionalWorkPending");
    expect(pending.ctx.total).toBe(working.ctx.total);
    expect(pending.ctx.additional).toMatchObject({ amount: price, lineId: EXTRA_COPPER_LINE, meters: 3, status: "pending" });
    expect(pending.ctx.lines.some((l) => l.id === EXTRA_COPPER_LINE)).toBe(false);

    const declined = run(pending, [{ type: "DECLINE_ADDITIONAL_WORK" }]);
    expect(declined.state).toBe("inProgress");
    expect(declined.ctx.total).toBe(working.ctx.total);
    expect(declined.ctx.lines).toEqual(working.ctx.lines);

    const approved = run(pending, [{ type: "APPROVE_ADDITIONAL_WORK" }]);
    expect(approved.ctx.total).toBe(working.ctx.total + price);
    expect(approved.ctx.lines).toContainEqual({ id: EXTRA_COPPER_LINE, amount: price });
    expect(approved.ctx.lines.find((l) => l.id === "work")!.amount).toBe(labor);
    expect(approved.ctx.additional?.status).toBe("approved");
    expect(approved.ctx.additional?.blocks).toBe(false);
  });

  it("keeps the generic additional-work line when no copper line is requested", () => {
    const working = installInProgress("2 t");
    const approved = run(working, [{ type: "REQUEST_ADDITIONAL_WORK", amount: 500 }], [{ type: "APPROVE_ADDITIONAL_WORK" }]);
    expect(approved.ctx.lines).toContainEqual({ id: "additional", amount: 500 });
    expect(approved.ctx.lines.some((l) => l.id === EXTRA_COPPER_LINE)).toBe(false);
  });
});
