/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildQuote, estimateRange } from "../src/core/pricing/quote";
import i18n from "../src/i18n";
import { jobsForCategory } from "../src/features/customer/catalogJobs";
import { Home } from "../src/features/customer/Home";
import { searchServices } from "../src/features/customer/searchIndex";

const uiSource = ["ServiceSearch.tsx", "searchIndex.ts", "Home.tsx", "tradePicker.tsx"]
  .map((name) => readFileSync(join(process.cwd(), "src/features/customer", name), "utf8"))
  .join("\n");

describe("catalog search", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("keeps job titles and metalwork ids out of the screen code", () => {
    expect(uiSource).not.toMatch(/Window security bars|Protecciones de ventana|FIXX-MTL-00/);
    const titles = jobsForCategory("metalwork", "en").map((job) => job.title);
    expect(titles.some((title) => title.startsWith("Window security bars"))).toBe(true);
    expect(titles).toHaveLength(5);
    expect(jobsForCategory("handyman", "en").some((job) => job.title.startsWith("Broken glass pane"))).toBe(true);
  });

  it("lights plumbing for a clogged bathroom and suggests the catalog drain and toilet jobs", () => {
    const result = searchServices("se tapó el baño", "en");
    expect(result.trades.plumbing).toBe("strong");
    expect(result.trades.handyman).toBe("soft");
    expect(result.trades.painting).toBe("dim");
    expect(result.trades.metalwork).toBe("dim");
    expect(result.chips.map((chip) => chip.taskId)).toEqual(["FIXX-PLM-006", "FIXX-PLM-001"]);
    expect(result.chips.map((chip) => chip.title)).toEqual(["Drain cleaning", "Toilet repair"]);
    expect(result.empty).toBe(false);
  });

  it("matches protecciones, rejas, and glass words to the workbook jobs", () => {
    const bars = searchServices("protecciones", "en");
    expect(bars.trades.metalwork).toBe("strong");
    expect(bars.chips[0]?.taskId).toBe("FIXX-MTL-001");
    expect(bars.chips[0]?.title.startsWith("Window security bars")).toBe(true);
    expect(bars.chips[0]?.pendingReview).toBe(false);
    expect(searchServices("rejas", "es").chips.some((chip) => chip.taskId === "FIXX-MTL-001")).toBe(true);
    for (const query of ["vidrio", "cristal", "glass"]) {
      const found = searchServices(query, query === "glass" ? "en" : "es");
      expect(found.chips.some((chip) => chip.taskId === "FIXX-HND-003" || chip.taskId === "FIXX-HND-005")).toBe(true);
    }
    const held = searchServices("carport", "en");
    expect(held.chips.some((chip) => chip.taskId === "FIXX-MTL-005" && chip.pendingReview)).toBe(true);
  });

  it("matches a Spanish query while the chip label stays in the active language", () => {
    const english = searchServices("destape", "en");
    expect(english.trades.plumbing).toBe("strong");
    expect(english.chips.some((chip) => chip.title === "Drain cleaning")).toBe(true);
    const spanish = searchServices("protecciones", "es");
    expect(spanish.chips[0]?.title.startsWith("Protecciones para ventana")).toBe(true);
    expect(spanish.chips[0]?.tradeName).toBe("Herrería");
    expect(searchServices("plomería", "en").trades.plumbing).toBe("strong");
  });

  it("marks a regulated catalog job without treating the tag as a booking", () => {
    const result = searchServices("termitas", "en");
    expect(result.trades.pest_control).toBe("strong");
    expect(result.chips[0]?.taskId).toBe("FIXX-PST-002");
    expect(result.chips[0]?.pendingReview).toBe(true);
    expect(result.chips[0]?.title.startsWith("Termite treatment")).toBe(true);
  });

  it("stays quiet for an empty query and reports no matches for nonsense", () => {
    const idle = searchServices("  ", "en");
    expect(idle.empty).toBe(false);
    expect(Object.values(idle.trades).every((tier) => tier === "idle")).toBe(true);
    expect(searchServices("xyz unicorn spa", "ko").empty).toBe(true);
    expect(searchServices("baño", "es").trades.plumbing).not.toBe("strong");
  });

  it("prices bookable metalwork from the workbook and does not treat it as pending quotes", () => {
    const range = estimateRange("metalwork", false, { taskIds: ["FIXX-MTL-001"] });
    expect(range.priced).toBe(true);
    expect(range.pendingQuotes).toBe(false);
    expect(range.low).not.toBe(Math.round(range.low));
    const quote = buildQuote("metalwork", false, { taskIds: ["FIXX-MTL-001"] });
    expect(quote.pendingPrice).toBe(false);
    expect(quote.pendingQuotes).toBe(false);
    expect(quote.total).toBeGreaterThan(0);
    expect(quote.total).not.toBe(Math.round(quote.total));
  });
});

describe("choose a service screen", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await i18n.changeLanguage("en");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderHome() {
    const picks: string[] = [];
    const jobs: string[] = [];
    const described = { current: false };
    render(
      <Home
        name="Eduardo L. Vasquez"
        email="eddymars93@gmail.com"
        onPick={(id) => picks.push(id)}
        onJob={(categoryId, taskId) => jobs.push(`${categoryId}:${taskId}`)}
        onDescribe={() => { described.current = true; }}
        onUrgent={() => undefined}
      />
    );
    return { picks, jobs, described };
  }

  it("debounces, then glows, chips, clears, and shows the empty state", () => {
    const { jobs, described } = renderHome();
    const input = screen.getByRole("searchbox");
    expect(input.getAttribute("placeholder")).toBe("What do you need to do at home?");
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBeNull();

    fireEvent.change(input, { target: { value: "se tapó el baño" } });
    expect(screen.queryByRole("button", { name: /Drain cleaning/ })).toBeNull();
    act(() => { vi.advanceTimersByTime(150); });

    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBe("strong");
    expect(screen.getByRole("button", { name: "Add Handyman" }).closest("li")?.getAttribute("data-match")).toBe("soft");
    expect(screen.getByRole("button", { name: "Add Painting" }).closest("li")?.getAttribute("data-match")).toBe("dim");
    const drain = screen.getByRole("button", { name: /Drain cleaning/ });
    expect(drain.textContent).toContain("Plumbing");
    fireEvent.click(drain);
    expect(jobs).toEqual(["plumbing:FIXX-PLM-006"]);
    expect(screen.getByText("2 trades match · 2 jobs suggested")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Add Painting" }).closest("li")?.getAttribute("data-match")).toBeNull();

    fireEvent.change(input, { target: { value: "xyz unicorn spa" } });
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByRole("heading", { name: "No matching services" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Plumbing" })).toBeNull();
    expect(screen.getByText(/Regulated jobs still go to review/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Describe it" }));
    expect(described.current).toBe(true);
    expect(screen.getAllByRole("button", { name: "Urgent request" })).toHaveLength(1);
  });

  it("shows the outline needs-review tag on a regulated chip", () => {
    renderHome();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "termitas" } });
    act(() => { vi.advanceTimersByTime(150); });
    const chip = screen.getByRole("button", { name: /Termite treatment/ });
    const badge = chip.querySelector(".search-review");
    expect(badge?.textContent).toContain("needs review");
    expect(badge?.className).not.toContain("warnAmber");
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});
