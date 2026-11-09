/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import catalogJson from "../src/seed/pricing/catalog.json";
import { quoteTask, quoteVisit, type Catalog } from "../src/core/pricing/instantQuote";
import { buildQuote, humanReviewForCategory } from "../src/core/pricing/quote";
import { isPendingQuotes } from "../src/core/pricing/reviewStatus";
import { allowedEvents, createSnapshot, jobMachine, newJobCtx, send } from "../src/core/machines";
import { jobsForCategory } from "../src/features/customer/catalogJobs";
import { EstimateView } from "../src/features/customer/Estimate";
import { QuoteView } from "../src/features/customer/QuoteView";
import { emptyDraft } from "../src/features/customer/session";
import i18n from "../src/i18n";

const cat = catalogJson as unknown as Catalog;
const t0 = new Date("2026-10-06T16:00:00Z");

function withLabor(taskId: string, patch: { flag?: string; reviewStatus?: string | null }): Catalog {
  const copy = JSON.parse(JSON.stringify(cat)) as Catalog;
  const key = `${taskId}|All`;
  const row = copy.labor[key];
  if (!row) throw new Error(`missing labor ${key}`);
  if (patch.flag != null) row.flag = patch.flag;
  if ("reviewStatus" in patch) row.reviewStatus = patch.reviewStatus ?? null;
  return copy;
}

describe("pending quotes are not bookable", () => {
  afterEach(() => cleanup());

  it("matches the labor flag and a PENDING QUOTES review status, ignoring case", () => {
    expect(isPendingQuotes("pending quotes")).toBe(true);
    expect(isPendingQuotes("Pending Quotes")).toBe(true);
    expect(isPendingQuotes("none", "PENDING QUOTES – herrero quotes not written")).toBe(true);
    expect(isPendingQuotes("none", "pending quotes")).toBe(true);
    expect(isPendingQuotes("regulated", "PENDING REVIEW – priced, not bookable until human approval")).toBe(false);
    expect(isPendingQuotes("none", "Bookable")).toBe(false);
  });

  it("keeps MTL-001 in review with no customer price", () => {
    const quote = quoteTask(cat, { taskId: "MTL-001", tier: "Standard", urgency: "STANDARD" });
    expect(quote.status).not.toBe("FIXED");
    expect(quote.needsHumanReview).toBe(true);
    expect(quote.humanReview).toEqual([{ kind: "labor", ref: "MTL-001|All", reason: "pending quotes" }]);
    expect(quote.total).toBe(0);
    expect(humanReviewForCategory("metalwork").some((item) => item.reason === "pending quotes")).toBe(true);
    expect(jobsForCategory("metalwork", "en")[0]?.pendingReview).toBe(true);
    const booked = buildQuote("metalwork", false);
    expect(booked.pendingQuotes).toBe(true);
    expect(booked.pendingPrice).toBe(true);
    expect(booked.total).toBe(0);
    expect(booked.lines).toEqual([]);
  });

  it("blocks a priced task when the flag or the review status says quotes are still pending", () => {
    const byFlag = quoteTask(withLabor("FIXX-PNT-001", { flag: "PENDING QUOTES" }), { taskId: "FIXX-PNT-001", tier: "Budget", urgency: "STANDARD" });
    expect(byFlag.status).toBe("QUOTE_ON_SITE");
    expect(byFlag.needsHumanReview).toBe(true);
    expect(byFlag.reasons).toContain("pending-quotes");
    const byStatus = quoteTask(withLabor("FIXX-PNT-001", { reviewStatus: "pending quotes – not written" }), { taskId: "FIXX-PNT-001", tier: "Budget", urgency: "STANDARD" });
    expect(byStatus.status).toBe("QUOTE_ON_SITE");
    expect(byStatus.needsHumanReview).toBe(true);
    const bookable = quoteTask(cat, { taskId: "FIXX-PNT-001", tier: "Budget", urgency: "STANDARD" });
    expect(bookable.status).toBe("FIXED");
    expect(bookable.needsHumanReview).toBe(false);
  });

  it("holds a pending-quotes line out of a bookable total", () => {
    const copy = JSON.parse(JSON.stringify(cat)) as Catalog;
    const line = copy.tasks["FIXX-PLM-001"]!.lines.find((item) => item.tier === "Budget" && item.type === "base");
    if (!line) throw new Error("missing base line");
    line.flag = "pending quotes";
    const quote = quoteTask(copy, { taskId: "FIXX-PLM-001", tier: "Budget", urgency: "STANDARD" });
    expect(quote.needsHumanReview).toBe(true);
    expect(quote.humanReview.some((item) => item.reason === "pending quotes")).toBe(true);
    expect(quote.status).not.toBe("FIXED");
  });

  it("does not open a deposit while the quote is still pending", () => {
    const needsReview = humanReviewForCategory("metalwork").length > 0;
    expect(needsReview).toBe(true);
    let snap = createSnapshot(jobMachine, newJobCtx({ needsReview }));
    for (const event of [
      { type: "ESTIMATE_READY" },
      { type: "RECOMMENDATIONS_READY" },
      { type: "SELECT_PROFESSIONAL", professionalId: "p2" }
    ] as const) {
      const step = send(jobMachine, snap, event, t0);
      if (!step.ok) throw new Error(step.error);
      snap = step.snapshot;
    }
    const unpriced = buildQuote("metalwork", false);
    const refused = send(jobMachine, snap, { type: "SEND_QUOTE", total: unpriced.total, travelFee: 0, payoutRatio: 0.8, lines: unpriced.lines }, t0);
    expect(refused.ok).toBe(false);
    expect(refused.snapshot.state).toBe("professionalSelected");
    const held = send(jobMachine, snap, { type: "SEND_QUOTE", total: 1800, travelFee: 80, payoutRatio: 0.8, lines: [{ id: "work", amount: 1800 }] }, t0);
    if (!held.ok) throw new Error(held.error);
    expect(held.snapshot.state).toBe("pendingReview");
    expect(held.snapshot.ctx.paid).toBe(0);
    expect(held.snapshot.ctx.initialDue).toBe(0);
    expect(allowedEvents(jobMachine, "pendingReview")).toEqual(["PENDING_REVIEW_APPROVED"]);
    const booked = send(jobMachine, held.snapshot, { type: "ACCEPT_QUOTE", method: "card", jobStart: t0 }, t0);
    expect(booked.ok).toBe(false);
    expect(booked.snapshot.state).toBe("pendingReview");
    const visit = quoteVisit(cat, [{ taskId: "MTL-001", tier: "Standard" }], "STANDARD");
    expect(visit.status).not.toBe("FIXED");
    expect(visit.total).toBe(0);
  });

  it("shows pending review and no price or deposit to the customer", async () => {
    await i18n.changeLanguage("en");
    const draft = emptyDraft({ categoryId: "metalwork", selectedJobIds: ["MTL-001"] });
    render(<EstimateView draft={draft} onNext={() => undefined} />);
    expect(screen.getByText("Pending review. The price is confirmed after the quotes are ready.")).toBeTruthy();
    expect(screen.getByText("Pending review")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    cleanup();
    render(
      <QuoteView
        ctx={newJobCtx({ total: 4800, lines: [{ id: "work", amount: 4800 }], travelFee: 80, needsReview: true })}
        draft={draft}
        professionalName="Marisol Treviño"
        now={t0}
        slotHours={30}
        method="card"
        onSlot={() => undefined}
        onMethod={() => undefined}
        onAccept={() => undefined}
        awaitingApproval
      />
    );
    expect(screen.getByText("Pending review. The price is confirmed after the quotes are ready.")).toBeTruthy();
    expect(screen.queryByText("4,800")).toBeNull();
    expect(screen.queryByText(/deposit/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept and sign" })).toBeNull();
  });
});
