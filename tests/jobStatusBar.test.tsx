/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import i18n from "../src/i18n";
import { JOB_STATUS_ORDER } from "../src/core/types/jobStatus";
import { JobStatusBar, STEP_ICONS } from "../src/features/shared/JobStatusBar";
import {
  CAPTION_MAX_PX,
  CURRENT_LINE_GAP_PX,
  FULL_GAP_MAX_PX,
  FULL_GAP_MIN_PX,
  LINE_CLEARANCE_PX,
  PHASES,
  R1_OUTER_PX,
  R2_OUTER_PX,
  RAIL_FULL_MAX_PX,
  RAIL_FULL_MIN_PX,
  captionAlign,
  edgeFadeVisibility,
  fullRowGap,
  meterStep,
  meterUsesFullRow,
  phaseForStatus,
  phaseIndexForStep,
  stripContentWidth,
  stripFits,
  stripNodeCenter,
  stripScrollLeft,
  visibleLinePx
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

  it("stops both connectors about 2px outside the lime ring, ignoring the glow", () => {
    expect(LINE_CLEARANCE_PX).toBe(2);
    expect(CURRENT_LINE_GAP_PX).toBe(Math.max(R2_OUTER_PX, R1_OUTER_PX) + LINE_CLEARANCE_PX);
    expect(CURRENT_LINE_GAP_PX).toBeGreaterThan(R2_OUTER_PX);
    expect(CURRENT_LINE_GAP_PX).toBeGreaterThan(R1_OUTER_PX);
    const css = readFileSync(join(process.cwd(), "src/features/shared/jobStatusBar.css"), "utf8");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain("var(--index) * var(--stride) - var(--line-gap)");
    expect(css).toContain("var(--index) * var(--stride) + var(--line-gap)");
    expect(css).toContain("var(--index) * (100% - var(--node)) / 11 - var(--line-gap)");
    expect(css).toContain("var(--index) * (100% - var(--node)) / 11 + var(--line-gap)");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toContain(".job-meter-r1 { display: block !important; }");
    expect(css).toContain("transition: width 300ms ease");
    expect(css).toContain(".job-meter-line-partial { transition: none; }");
    expect(css).toContain("var(--progress) * (var(--stride) - var(--line-gap) - var(--node) / 2)");
    expect(css).toContain("var(--progress) * ((100% - var(--node)) / 11 - var(--line-gap) - var(--node) / 2)");
    expect(css).not.toMatch(/#fff\b|#ffffff/i);
  });
});

describe("twelve-step layout", () => {
  const view = 328;

  it("gives every status its own icon and drops the phase labels from the rail", () => {
    expect(Object.keys(STEP_ICONS)).toEqual([...JOB_STATUS_ORDER]);
    expect(STEP_ICONS.requestSubmitted.displayName).toBe("PaperPlaneTiltIcon");
    expect(STEP_ICONS.estimated.displayName).toBe("TagIcon");
    expect(STEP_ICONS.professionalSelected.displayName).toBe("UserCheckIcon");
    expect(STEP_ICONS.quoteSent.displayName).toBe("ReceiptIcon");
    expect(STEP_ICONS.quoteAccepted.displayName).toBe("HandshakeIcon");
    expect(STEP_ICONS.scheduled.displayName).toBe("CalendarCheckIcon");
    expect(STEP_ICONS.onTheWay.displayName).toBe("TruckIcon");
    expect(STEP_ICONS.inProgress.displayName).toBe("WrenchIcon");
    expect(STEP_ICONS.markedComplete.displayName).toBe("CheckCircleIcon");
    expect(STEP_ICONS.issueWindow.displayName).toBe("ShieldWarningIcon");
    expect(STEP_ICONS.paymentReleased.displayName).toBe("WalletIcon");
    expect(STEP_ICONS.rated.displayName).toBe("StarIcon");
  });

  it("uses the full row only at the tablet breakpoint when the rail is at least 674px", () => {
    expect(RAIL_FULL_MIN_PX).toBe(674);
    expect(RAIL_FULL_MAX_PX).toBe(960);
    expect(FULL_GAP_MIN_PX).toBe(22);
    expect(FULL_GAP_MAX_PX).toBe(48);
    expect(meterUsesFullRow(false, 800)).toBe(false);
    expect(meterUsesFullRow(false, 1200)).toBe(false);
    expect(meterUsesFullRow(true, 673)).toBe(false);
    expect(meterUsesFullRow(true, 674)).toBe(true);
    expect(meterUsesFullRow(true, 686)).toBe(true);
    expect(fullRowGap(673)).toBeLessThan(22);
    expect(fullRowGap(674)).toBe(22);
    expect(fullRowGap(686)).toBeCloseTo(23.0909, 3);
    expect(visibleLinePx(fullRowGap(686))).toBeCloseTo(16.0909, 3);
    expect(visibleLinePx(22)).toBe(15);
    expect(fullRowGap(960)).toBe(48);
    expect(fullRowGap(1280)).toBe(48);
    expect(CAPTION_MAX_PX).toBe(140);
    expect(captionAlign(1)).toBe("start");
    expect(captionAlign(6)).toBe("center");
    expect(captionAlign(11)).toBe("center");
    expect(captionAlign(12)).toBe("end");
  });

  it("centers the current node and clamps the ends of the strip", () => {
    expect(stripScrollLeft(1, view)).toBe(0);
    expect(stripScrollLeft(2, view)).toBe(0);
    const content = stripContentWidth();
    const maxScroll = content - view;
    expect(stripScrollLeft(11, view)).toBe(maxScroll);
    expect(stripScrollLeft(12, view)).toBe(maxScroll);
    const mid = stripScrollLeft(6, view);
    expect(mid).toBe(stripNodeCenter(6) - view / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(maxScroll);
    expect(stripScrollLeft(6, content + 40)).toBe(0);
    expect(stripFits(content - 1)).toBe(false);
    expect(stripFits(content)).toBe(true);
    expect(stripFits(content + 40)).toBe(true);
    expect(edgeFadeVisibility(0, content + 40, content)).toEqual({ start: false, end: false });
    expect(edgeFadeVisibility(0, view, content)).toEqual({ start: false, end: true });
    expect(edgeFadeVisibility(maxScroll, view, content)).toEqual({ start: true, end: false });
    expect(edgeFadeVisibility(mid, view, content)).toEqual({ start: true, end: true });
    expect(edgeFadeVisibility(0, content, content)).toEqual({ start: false, end: false });
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
    expect(document.querySelector(".job-meter-line-rest")).toBeTruthy();
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("requestSubmitted");
    expect(document.querySelector(".job-meter-caption")?.getAttribute("data-align")).toBe("start");
    expect(document.querySelector(".job-meter-caption")?.textContent).toBe("Request sent");
    expect(document.querySelectorAll(".job-meter-node")).toHaveLength(12);
    expect(document.querySelectorAll(".job-meter-node-upcoming")).toHaveLength(11);
    expect(document.querySelector("button")).toBeNull();
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--line-gap")).toBe(`${CURRENT_LINE_GAP_PX}px`);
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("strip");
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
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("onTheWay");
    expect(document.querySelectorAll(".job-meter-node-done")).toHaveLength(6);
    expect(document.querySelectorAll(".job-meter-node-upcoming")).toHaveLength(5);
    expect(document.querySelector(".job-meter-line-done")).toBeTruthy();
    expect(document.querySelector(".job-meter-line-rest")).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--index")).toBe("6");
    expect(document.querySelector(".job-meter-arc circle")?.getAttribute("stroke-linecap")).toBe("round");
    expect(document.querySelector(".job-meter-arc circle")?.getAttribute("stroke-dasharray")).toBe("98.96 32.99");
    const statuses = [...document.querySelectorAll(".job-meter-node")].map((node) => node.getAttribute("data-status"));
    expect(statuses).toEqual([...JOB_STATUS_ORDER]);
  });

  it("omits Next on the last step", async () => {
    await i18n.changeLanguage("en");
    render(<JobStatusBar status="rated" scheduledAt={APPOINTMENT} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("12");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Rated");
    expect(screen.queryByText(/Next:/)).toBeNull();
    expect(document.querySelector(".job-meter-line-rest")).toBeNull();
    expect(document.querySelector(".job-meter-line-done")).toBeTruthy();
    expect(document.querySelector(".job-meter-caption")?.getAttribute("data-align")).toBe("end");
    expect(document.querySelectorAll(".job-meter-node-done")).toHaveLength(11);
  });

  it("uses the Spanish and Korean step names", async () => {
    await i18n.changeLanguage("es");
    const es = render(<JobStatusBar status="issueWindow" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Plazo para reportar abierto");
    expect(screen.getByText("Paso 10 de 12")).toBeTruthy();
    expect(screen.queryByText("Cierre")).toBeNull();
    expect(screen.queryByText("Visita")).toBeNull();
    expect(document.querySelector(".job-meter-caption")?.textContent).toBe("Plazo para reportar abierto");
    expect(screen.getByText("Pago liberado")).toBeTruthy();
    es.unmount();

    await i18n.changeLanguage("ko");
    render(<JobStatusBar status="scheduled" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("일정 확정됨");
    expect(screen.getByText("12단계 중 6단계")).toBeTruthy();
    expect(screen.queryByText("방문")).toBeNull();
    expect(document.querySelector(".job-meter-caption")?.textContent).toBe("일정 확정됨");
    expect(screen.getByText("이동 중")).toBeTruthy();
  });
});

describe("meter layout switch", () => {
  const scrollCalls: { left: number; behavior: string }[] = [];
  let railWidth = 0;
  let wide = false;
  let reduce = false;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalClientWidth: PropertyDescriptor | undefined;
  let originalScrollTo: typeof HTMLElement.prototype.scrollTo | undefined;

  function install() {
    originalMatchMedia = window.matchMedia;
    originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    originalScrollTo = HTMLElement.prototype.scrollTo;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query.includes("768") ? wide : query.includes("reduce") ? reduce : false;
      },
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })) as typeof window.matchMedia;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return (this as HTMLElement).classList?.contains("job-meter-rail") ? railWidth : 0;
      }
    });
    HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number) {
      const left = typeof options === "number" ? options : options?.left ?? 0;
      const behavior = typeof options === "object" && options?.behavior ? options.behavior : "auto";
      scrollCalls.push({ left, behavior });
      this.scrollLeft = left;
    };
  }

  function restore() {
    if (originalMatchMedia) window.matchMedia = originalMatchMedia;
    else delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    if (originalScrollTo) HTMLElement.prototype.scrollTo = originalScrollTo;
  }

  afterEach(async () => {
    cleanup();
    restore();
    scrollCalls.length = 0;
    railWidth = 0;
    wide = false;
    reduce = false;
    await i18n.changeLanguage("en");
  });

  it("keeps the strip below 768px and when the rail is under 674px", () => {
    wide = false;
    railWidth = 400;
    install();
    render(<JobStatusBar status="scheduled" />);
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("strip");
    expect(document.querySelector(".job-meter-rail")?.getAttribute("data-fits")).toBe("false");
    expect(document.querySelector(".job-meter-rail")?.getAttribute("tabindex")).toBe("-1");
    expect(scrollCalls.at(-1)).toEqual({ left: stripScrollLeft(6, 400), behavior: "smooth" });

    cleanup();
    scrollCalls.length = 0;
    wide = true;
    railWidth = 673;
    render(<JobStatusBar status="scheduled" />);
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("strip");
    expect(document.querySelector(".job-meter-rail")?.getAttribute("data-fits")).toBe("true");
    expect(document.querySelector(".job-meter-fade")).toBeNull();
  });

  it("centers a strip that has nothing to scroll and hides both fades", () => {
    wide = false;
    railWidth = stripContentWidth() + 40;
    install();
    render(<JobStatusBar status="scheduled" />);
    const rail = document.querySelector(".job-meter-rail");
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("strip");
    expect(rail?.getAttribute("data-fits")).toBe("true");
    expect(document.querySelector(".job-meter-fade-start")).toBeNull();
    expect(document.querySelector(".job-meter-fade-end")).toBeNull();
    expect(scrollCalls).toEqual([]);
    expect(rail?.scrollLeft ?? 0).toBe(0);
  });

  it("switches to the full row at 768px once the rail reaches 674px, with no scroll and no fades", () => {
    wide = true;
    railWidth = 674;
    install();
    render(<JobStatusBar status="scheduled" />);
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("full");
    expect(document.querySelector(".job-meter-rail")?.hasAttribute("tabindex")).toBe(false);
    expect(document.querySelector(".job-meter-fade")).toBeNull();
    expect(scrollCalls).toEqual([]);
    expect(document.querySelectorAll(".job-meter-node")).toHaveLength(12);
  });

  it("re-centers the strip when the layout falls back and jumps when motion is reduced", () => {
    wide = true;
    railWidth = 800;
    reduce = true;
    install();
    render(<JobStatusBar status="scheduled" />);
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("full");

    wide = false;
    railWidth = 400;
    act(() => { window.dispatchEvent(new Event("resize")); });
    expect(document.querySelector(".job-meter-frame")?.getAttribute("data-layout")).toBe("strip");
    expect(scrollCalls.at(-1)).toEqual({ left: stripScrollLeft(6, 400), behavior: "auto" });
    expect(document.querySelector(".job-meter-fade-start")).toBeTruthy();
    expect(document.querySelector(".job-meter-fade-end")).toBeTruthy();
  });

  it("hides the fade on the side that is clamped", () => {
    wide = false;
    railWidth = 328;
    install();
    const { rerender } = render(<JobStatusBar status="requestSubmitted" />);
    expect(document.querySelector(".job-meter-fade-start")).toBeNull();
    expect(document.querySelector(".job-meter-fade-end")).toBeTruthy();

    rerender(<JobStatusBar status="rated" />);
    expect(document.querySelector(".job-meter-fade-start")).toBeTruthy();
    expect(document.querySelector(".job-meter-fade-end")).toBeNull();

    rerender(<JobStatusBar status="scheduled" />);
    expect(document.querySelector(".job-meter-fade-start")).toBeTruthy();
    expect(document.querySelector(".job-meter-fade-end")).toBeTruthy();
  });
});

describe("sub-step line fill", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("draws no lime when the current step is 0% done", () => {
    render(<JobStatusBar status="requestSubmitted" progress={0} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("aria-valuetext")).toBe("Request sent, 0% of this step");
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();
    expect(document.querySelector(".job-meter-line-rest")).toBeTruthy();
  });

  it("fills half the connector to the next step at 50%", () => {
    render(<JobStatusBar status="requestSubmitted" progress={0.5} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(bar.getAttribute("aria-valuetext")).toBe("Request sent, 50% of this step");
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--progress")).toBe("0.5");
    expect(document.querySelector(".job-meter-line-partial")).toBeTruthy();
    expect(document.querySelector(".job-meter-line-rest")).toBeTruthy();
  });

  it("fills the connector to the next node at 100%", () => {
    render(<JobStatusBar status="scheduled" progress={1} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Scheduled, 100% of this step");
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--progress")).toBe("1");
    expect(document.querySelector(".job-meter-line-partial")).toBeTruthy();
  });

  it("drops the partial fill while a regulated job is held for review", () => {
    render(<JobStatusBar status="onTheWay" pendingReview progress={0.5} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("12");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuetext")).toBe("Request sent");
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();
  });

  it("uses the Spanish and Korean percent strings", async () => {
    await i18n.changeLanguage("es");
    const es = render(<JobStatusBar status="requestSubmitted" progress={0.5} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Solicitud enviada, 50% de este paso");
    es.unmount();
    await i18n.changeLanguage("ko");
    render(<JobStatusBar status="requestSubmitted" progress={0.5} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("요청 전송됨, 이 단계의 50%");
  });
});
