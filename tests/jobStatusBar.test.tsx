/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18n from "../src/i18n";
import { JOB_STATUS_ORDER } from "../src/core/types/jobStatus";
import { JobStatusBar } from "../src/features/shared/JobStatusBar";
import {
  CURRENT_LINE_GAP_PX,
  LINE_CLEARANCE_PX,
  PHASES,
  R1_GLOW_PX,
  R1_OUTER_PX,
  R2_GLOW_PX,
  R2_OUTER_PX,
  meterStep,
  phaseForStatus,
  phaseIndexForStep
} from "../src/features/shared/jobPhases";

const APPOINTMENT = new Date("2026-11-12T02:00:00.000Z");

describe("job progress phases", () => {
  it("groups the twelve statuses into Request, Quote, Visit, and Finish", () => {
    const expected = PHASES.flatMap((phase) => Array.from({ length: phase.to - phase.from + 1 }, () => phase.id));
    expect(expected).toEqual([
      "request", "request",
      "quote", "quote", "quote",
      "visit", "visit", "visit", "visit",
      "finish", "finish", "finish"
    ]);
    JOB_STATUS_ORDER.forEach((status, index) => {
      expect(phaseForStatus(status)).toBe(expected[index]);
    });
    expect(phaseIndexForStep(1)).toBe(0);
    expect(phaseIndexForStep(6)).toBe(2);
    expect(phaseIndexForStep(7)).toBe(2);
    expect(phaseIndexForStep(10)).toBe(3);
    expect(phaseIndexForStep(12)).toBe(3);
  });

  it("stops both connectors past the current ring and its glow", () => {
    expect(CURRENT_LINE_GAP_PX).toBeGreaterThanOrEqual(R2_OUTER_PX + R2_GLOW_PX + LINE_CLEARANCE_PX);
    expect(CURRENT_LINE_GAP_PX).toBeGreaterThanOrEqual(R1_OUTER_PX + R1_GLOW_PX + LINE_CLEARANCE_PX);
    const css = readFileSync(join(process.cwd(), "src/features/shared/jobStatusBar.css"), "utf8");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain("calc(var(--to-current) - var(--line-gap))");
    expect(css).toContain("calc(12.5% + var(--to-current) + var(--line-gap))");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toContain(".job-meter-r1 { display: block !important; }");
  });
});

describe("job progress meter", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("holds a regulated job at step 1, with no date and no Next line", async () => {
    await i18n.changeLanguage("en");
    expect(meterStep("onTheWay", true)).toBe(1);
    render(<JobStatusBar status="onTheWay" pendingReview scheduledAt={APPOINTMENT} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("12");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuetext")).toBe("Request sent");
    expect(screen.getByText("Pending review")).toBeTruthy();
    expect(screen.getByText("Step 1 of 12")).toBeTruthy();
    expect(screen.getByText(/specialist will check this job/)).toBeTruthy();
    expect(screen.queryByText(/Next:/)).toBeNull();
    expect(screen.queryByText(/Scheduled for/)).toBeNull();
    expect(document.querySelector(".job-meter-line-done")).toBeNull();
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-phase")).toBe("request");
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--line-gap")).toBe(`${CURRENT_LINE_GAP_PX}px`);
  });

  it("shows a mid-journey step, the next name, and both rounded connectors", async () => {
    await i18n.changeLanguage("en");
    render(<JobStatusBar status="onTheWay" scheduledAt={APPOINTMENT} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("7");
    expect(bar.getAttribute("aria-valuetext")).toBe("On the way");
    expect(screen.getByText("Step 7 of 12")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText(/Scheduled for/)).toBeTruthy();
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-phase")).toBe("visit");
    expect(document.querySelectorAll(".job-meter-node-done")).toHaveLength(2);
    expect(document.querySelector(".job-meter-line-done")).toBeTruthy();
    expect(document.querySelector(".job-meter-line-rest")).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--to-current")).toBe("50%");
    expect(document.querySelector(".job-meter-arc circle")?.getAttribute("stroke-linecap")).toBe("round");
  });

  it("omits Next on the last step", async () => {
    await i18n.changeLanguage("en");
    render(<JobStatusBar status="rated" scheduledAt={APPOINTMENT} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("12");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Rated");
    expect(screen.queryByText(/Next:/)).toBeNull();
    expect(document.querySelector(".job-meter-line-rest")).toBeNull();
    expect(document.querySelector(".job-meter-line-done")).toBeTruthy();
  });

  it("uses the Spanish and Korean step names", async () => {
    await i18n.changeLanguage("es");
    const es = render(<JobStatusBar status="issueWindow" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Plazo para reportar abierto");
    expect(screen.getByText("Paso 10 de 12")).toBeTruthy();
    expect(screen.getByText("Cierre")).toBeTruthy();
    expect(screen.getByText("Pago liberado")).toBeTruthy();
    es.unmount();

    await i18n.changeLanguage("ko");
    render(<JobStatusBar status="scheduled" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("일정 확정됨");
    expect(screen.getByText("12단계 중 6단계")).toBeTruthy();
    expect(screen.getByText("방문")).toBeTruthy();
    expect(screen.getByText("이동 중")).toBeTruthy();
  });
});
