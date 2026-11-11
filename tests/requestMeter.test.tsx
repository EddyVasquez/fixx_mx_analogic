/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { jobMachine, newJobCtx, type JobState } from "../src/core/machines";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { RequestBuilder, RequestReview } from "../src/features/customer/RequestBuilder";
import { requestSubProgress } from "../src/features/customer/requestProgress";
import { JOB_ID, emptyDraft, resetSession, session } from "../src/features/customer/session";

const noop = () => undefined;

function openRequest(): void {
  session.signedIn = true;
  session.tab = "request";
}

function spawn(state: JobState, categoryId = "electrical"): void {
  runtime.spawn(JOB_ID, "job", jobMachine, newJobCtx({ total: 1800.5, professionalId: "p3" }), { categoryId }, state);
  session.draft = emptyDraft({ categoryId });
}

describe("request journey meter", () => {
  beforeEach(async () => {
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    cleanup();
    runtime.reset();
    resetSession(false);
    await i18n.changeLanguage("en");
  });

  it("starts with nothing filled until a trade is chosen", () => {
    openRequest();
    render(<CustomerApp />);
    const bar = screen.getByRole("progressbar");
    expect(screen.getByText("Choose your service")).toBeTruthy();
    expect(screen.getByText("Step 1 of 12")).toBeTruthy();
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuetext")).toBe("Choose your service");
    expect(document.querySelector(".job-meter-node-current")).toBeNull();
    expect(document.querySelector(".job-meter-caption")).toBeNull();
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();
    expect(document.querySelector(".job-meter-line-done")).toBeNull();
    expect(screen.queryByText("Request sent")).toBeNull();
    expect(document.querySelector(".job-meter-sticky")).toBeTruthy();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });

  it("asks for a trade before the request can be reviewed", () => {
    const draft = emptyDraft({ categoryId: "", description: "Paint the hall" });
    render(<RequestBuilder draft={draft} onChange={noop} onReview={noop} />);
    const review = screen.getByRole("button", { name: "Review request" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    expect(screen.getByText("Choose a service so we know which trade to send.")).toBeTruthy();
    expect(document.querySelector('[data-selected="true"]')).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows the chosen trade and keeps the sub-step fraction until send", () => {
    const draft = emptyDraft({
      categoryId: "electrical",
      description: "Replace the outlet",
      photos: 0,
      emergency: false,
      street: "Sierra Picachos 402"
    });
    expect(requestSubProgress(draft)).toBe(0.5);
    session.draft = draft;
    session.openBuilder = true;
    openRequest();
    render(<CustomerApp />);
    const bar = screen.getByRole("progressbar");
    expect(screen.getByText("Electrical service chosen")).toBeTruthy();
    expect(screen.getByText("Requesting")).toBeTruthy();
    expect(screen.queryByText("Request sent")).toBeNull();
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("requestSubmitted");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(bar.getAttribute("aria-valuetext")).toBe("Requesting, 50% of this step");
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--progress")).toBe("0.5");
    expect(document.querySelector(".job-meter-line-partial")).toBeTruthy();
  });

  it("counts photos and address together, and the review screen as the fourth sub-step", () => {
    const base = { categoryId: "electrical", description: "Outlet", photos: 0, emergency: false, street: "Calle 1" };
    expect(requestSubProgress(base)).toBe(0.5);
    expect(requestSubProgress({ ...base, photos: 1 })).toBe(0.75);
    expect(requestSubProgress({ ...base, emergency: true })).toBe(0.75);
    expect(requestSubProgress({ ...base, photos: 1, street: "  " })).toBe(0.5);
    expect(requestSubProgress({ ...base, photos: 1 }, true)).toBe(1);

    const draft = emptyDraft({ ...base, photos: 2 });
    session.draft = draft;
    render(<RequestReview draft={draft} onEdit={noop} onSubmit={noop} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("fills the price-range step halfway once the request is sent", () => {
    spawn("estimated", "painting");
    openRequest();
    render(<CustomerApp />);
    const bar = screen.getByRole("progressbar");
    expect(document.querySelector(".job-meter-title")?.textContent).toBe("Price range ready");
    expect(screen.getByText("Step 2 of 12")).toBeTruthy();
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("12");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuetext")).toBe("Price range ready");
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("estimated");
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--progress")).toBe("0.5");
    expect(document.querySelector(".job-meter-line-partial")).toBeTruthy();
    expect(document.querySelector(".job-meter-line-done")).toBeTruthy();
    expect(screen.queryByText("Pending review")).toBeNull();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });

  it("keeps one meter on every later screen, and holds a regulated job with no lime", () => {
    const halfway: JobState[] = [
      "recommendations",
      "professionalSelected",
      "quoteSent",
      "awaitingDeposit",
      "scheduled",
      "onTheWay",
      "paymentReleased"
    ];
    for (const state of halfway) {
      cleanup();
      runtime.reset();
      resetSession(false);
      session.signedIn = true;
      spawn(state);
      openRequest();
      render(<CustomerApp />);
      const bar = screen.getByRole("progressbar");
      expect(screen.getAllByRole("progressbar"), state).toHaveLength(1);
      expect(document.querySelector(".job-meter-line-partial"), state).toBeTruthy();
      expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--progress"), state).toBe("0.5");
      expect(bar.getAttribute("aria-valuemin"), state).toBe("1");
      expect(Number(bar.getAttribute("aria-valuenow")), state).toBeGreaterThan(1);
    }

    cleanup();
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    spawn("rated");
    openRequest();
    render(<CustomerApp />);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("12");
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();

    cleanup();
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    spawn("pendingReview");
    openRequest();
    render(<CustomerApp />);
    const held = screen.getByRole("progressbar");
    expect(document.querySelector(".job-meter-badge")?.textContent).toContain("Pending review");
    expect(document.querySelector(".job-meter-title")?.textContent).toBe("Request sent");
    expect(held.getAttribute("aria-valuenow")).toBe("1");
    expect(held.getAttribute("aria-valuetext")).toBe("Request sent");
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();
    expect(document.querySelector(".job-meter-line-done")).toBeNull();

    cleanup();
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    spawn("cancelled");
    openRequest();
    render(<CustomerApp />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("pins the meter under the tablet header", () => {
    const css = readFileSync(join(process.cwd(), "src/features/shared/jobStatusBar.css"), "utf8");
    expect(css).toMatch(/\.job-meter-sticky\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*\.job-meter-sticky\s*\{\s*top:\s*80px;\s*\}/);
  });
});
