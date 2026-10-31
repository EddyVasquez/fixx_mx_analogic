/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { jobsForCategory } from "../src/features/customer/catalogJobs";
import { resetDemoMode, setDemoMode } from "../src/features/customer/demoMode";
import { DEMO_JOB_SEEDS, DEMO_WARRANTY_SEEDS, demoJobViews, demoWarrantyViews } from "../src/features/customer/demoSamples";
import { resetHomeProfile } from "../src/features/customer/homeProfile";
import { resetSession, session } from "../src/features/customer/session";
import { TRADE_ICONS } from "../src/features/customer/tradeIcons";
import categories from "../src/seed/categories.json";

describe("Santa Sofía demo jobs and warranties", () => {
  beforeEach(async () => {
    resetHomeProfile();
    resetDemoMode();
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    resetDemoMode();
    resetHomeProfile();
    runtime.reset();
    resetSession(false);
    await i18n.changeLanguage("en");
  });

  it("is on by default and shows sample jobs at different statuses, with centavos", () => {
    const now = runtime.clock.now();
    const jobs = demoJobViews(now, "en");
    expect(jobs.map((job) => job.status)).toEqual(["scheduled", "inProgress", "pendingReview"]);
    expect(jobs.map((job) => job.professionalName)).toEqual(["Luis Hernández", "Luis Hernández", "Ana Cantú"]);
    expect(jobs.every((job) => Number.isInteger(Math.round(job.total * 100)))).toBe(true);
    expect(jobs[2]?.pendingReview).toBe(true);
    expect(jobsForCategory("pest_control", "en").find((job) => job.id === "FIXX-PST-001")?.pendingReview).toBe(true);
    categories.forEach((category) => expect(TRADE_ICONS[category.id]).toBeTruthy());

    render(<CustomerApp />);
    expect((screen.getByRole("checkbox", { name: "Sample home data" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Sample jobs and warranties for the Santa Sofía home/)).toBeTruthy();
    expect(document.querySelectorAll("[data-demo-job]")).toHaveLength(DEMO_JOB_SEEDS.length);

    const plumbing = document.querySelector('[data-demo-job="demo-plm"]');
    expect(plumbing?.textContent).toContain("Plumbing with Luis Hernández");
    expect(plumbing?.textContent).toContain("Toilet repair");
    expect(plumbing?.textContent).toContain("Scheduled");
    expect(plumbing?.textContent).toContain("Total: $780.50 MXN");
    expect(plumbing?.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("25");

    expect(screen.getByText("HVAC with Luis Hernández")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText("Total: $864.25 MXN")).toBeTruthy();
    expect(document.querySelector('[data-demo-job="demo-hvc"] [role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("60");

    const review = document.querySelector('[data-demo-job="demo-pst"]');
    expect(review?.textContent).toContain("Pending review");
    expect(review?.textContent).toContain("Pest control with Ana Cantú");
    expect(review?.textContent).toContain("Total: $1,200.40 MXN");
    expect(review?.textContent).not.toMatch(/booked/i);
    expect(document.body.textContent).not.toMatch(/\b(margin|commission)\b/i);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sample home data" }));
    expect(document.querySelectorAll("[data-demo-job]")).toHaveLength(0);
    expect(screen.getByText("No active jobs. Need something fixed?")).toBeTruthy();
    expect(localStorage.getItem("fixx.demoMode")).toBe("0");
  });

  it("shows active warranties, one expiring soon and one claim in progress", () => {
    const now = runtime.clock.now();
    const items = demoWarrantyViews(now, "en");
    expect(items.map((item) => item.daysLeft)).toEqual(DEMO_WARRANTY_SEEDS.map((seed) => seed.daysLeft));
    expect(items.filter((item) => item.expiringSoon)).toHaveLength(1);
    expect(items.filter((item) => item.claimInProgress)).toHaveLength(1);

    render(<CustomerApp />);
    expect(screen.getByText("Expiring soon")).toBeTruthy();
    expect(screen.getByText("Claim in progress")).toBeTruthy();
    expect(screen.getByText("4 days left")).toBeTruthy();
    expect(screen.getByText("Painting with Marisol Treviño")).toBeTruthy();
    expect(screen.getAllByText(/Coverage ends /).length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole("link", { name: "Warranty" }));
    expect(screen.getByRole("heading", { name: "Warranty" })).toBeTruthy();
    expect(document.querySelectorAll("[data-demo-warranty]").length).toBeGreaterThanOrEqual(DEMO_WARRANTY_SEEDS.length);
    expect(screen.getAllByText("Claim in progress").length).toBeGreaterThan(0);
    expect(screen.getByText("Standard home cleaning (tier = home size)")).toBeTruthy();
  });

  it("marks the Korean sample copy as a draft", () => {
    const ko = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/ko/demo.json"), "utf8")) as Record<string, { status: string; needsNativeReview?: boolean }>;
    for (const key of ["demo.mode.label", "demo.mode.note", "demo.job.progress", "demo.warranty.expiring", "demo.warranty.claim", "demo.warranty.ends"]) {
      expect(ko[key]?.status).toBe("draft");
      expect(ko[key]?.needsNativeReview).toBe(true);
    }
  });

  it("turns off when a test asks, and back on for the demo build", () => {
    setDemoMode(false);
    expect(demoJobViews(new Date(), "en")).toHaveLength(3);
    render(<CustomerApp />);
    expect((screen.getByRole("checkbox", { name: "Sample home data" }) as HTMLInputElement).checked).toBe(false);
    expect(document.querySelector("[data-demo-job]")).toBeNull();
  });
});
