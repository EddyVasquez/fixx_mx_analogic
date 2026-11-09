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
    expect(uiSource).not.toMatch(/Window security bars|Protecciones de ventana|MTL-00/);
    expect(jobsForCategory("metalwork", "en").map((job) => job.title)).toEqual(["Window security bars"]);
    expect(jobsForCategory("metalwork", "es").map((job) => job.title)).toEqual(["Protecciones de ventana"]);
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

  it("matches protecciones to the catalog window-bar job and ignores metalwork ids that are not priced in yet", () => {
    const result = searchServices("protecciones", "en");
    expect(result.trades.metalwork).toBe("strong");
    expect(result.trades.locksmith).toBe("soft");
    expect(result.chips.map((chip) => chip.taskId)).toEqual(["MTL-001"]);
    expect(result.chips[0]?.title).toBe("Window security bars");
    expect(result.chips[0]?.tradeName).toBe("Metalwork");
    expect(result.chips[0]?.pendingReview).toBe(true);
  });

  it("matches a Spanish query while the chip label stays in the active language", () => {
    const english = searchServices("destape", "en");
    expect(english.trades.plumbing).toBe("strong");
    expect(english.chips.some((chip) => chip.title === "Drain cleaning")).toBe(true);
    const spanish = searchServices("protecciones", "es");
    expect(spanish.chips[0]?.title).toBe("Protecciones de ventana");
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

  it("does not invent a metalwork price", () => {
    const range = estimateRange("metalwork", false);
    expect(range.priced).toBe(false);
    expect(range.pendingQuotes).toBe(true);
    const quote = buildQuote("metalwork", false);
    expect(quote.pendingPrice).toBe(true);
    expect(quote.pendingQuotes).toBe(true);
    expect(quote.lines).toEqual([]);
    expect(quote.total).toBe(0);
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
