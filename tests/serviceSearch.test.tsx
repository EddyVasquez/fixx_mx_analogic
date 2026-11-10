/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildQuote, estimateRange } from "../src/core/pricing/quote";
import i18n from "../src/i18n";
import { catalogJobRecords, jobsForCategory } from "../src/features/customer/catalogJobs";
import { categories } from "../src/features/customer/data";
import { Home } from "../src/features/customer/Home";
import { searchServices } from "../src/features/customer/searchIndex";
import { koreanSynonymStatus, rooms, tradeSynonyms } from "../src/data/searchSynonyms";

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
    // "baño" is the room, so the other bathroom trades glow soft beside the clog.
    expect(result.trades.painting).toBe("soft");
    expect(result.trades.electrical).toBe("soft");
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
    expect(idle.status).toBe("idle");
    expect(Object.values(idle.trades).every((tier) => tier === "idle")).toBe(true);
    expect(searchServices("xyz unicorn spa", "ko").empty).toBe(true);
    expect(searchServices("zzzz", "en")).toMatchObject({ empty: true, status: "empty", tradeCount: 0 });
    expect(searchServices("something random please", "en").empty).toBe(true);
  });

  it("keeps a single letter and unfinished 2-character misses on the idle grid", () => {
    for (const query of ["a", "A", "p", "P", "ñ"]) {
      const result = searchServices(query, "en");
      expect(result.status).toBe("idle");
      expect(result.empty).toBe(false);
      expect(Object.values(result.trades).every((tier) => tier === "idle")).toBe(true);
    }
    const almost = searchServices("zz", "es");
    expect(almost.status).toBe("idle");
    expect(almost.empty).toBe(false);
  });

  it("lights trades from word prefixes before the full word is typed", () => {
    const pl = searchServices("pl", "en");
    expect(pl.status).toBe("hit");
    expect(pl.empty).toBe(false);
    expect(pl.trades.plumbing).toBe("strong");
    expect(pl.trades.painting).toBe("dim");

    const plom = searchServices("plom", "ko");
    expect(plom.trades.plumbing).toBe("strong");
    expect(plom.trades.pest_control).toBe("dim");
    expect(plom.trades.painting).toBe("dim");
    expect(plom.empty).toBe(false);

    const herr = searchServices("herr", "en");
    expect(herr.trades.metalwork).toBe("strong");
    expect(herr.trades.locksmith).toBe("soft");
    expect(herr.trades.plumbing).toBe("dim");

    const prot = searchServices("prot", "es");
    expect(prot.trades.metalwork).toBe("strong");
    expect(prot.trades.locksmith).toBe("soft");
    expect(prot.chips[0]?.taskId).toBe("FIXX-MTL-001");
    expect(prot.empty).toBe(false);

    const vid = searchServices("vid", "en");
    expect(vid.trades.handyman).toBe("strong");
    expect(vid.trades.painting).toBe("dim");
    expect(vid.chips.some((chip) => chip.taskId === "FIXX-HND-003" || chip.taskId === "FIXX-HND-005")).toBe(true);

    expect(searchServices("방범", "ko").trades.metalwork).toBe("strong");
    expect(searchServices("배관", "en").trades.plumbing).toBe("strong");
    expect(searchServices("철물", "en").trades.metalwork).toBe("strong");
  });

  it("ignores conversational filler until a trigger word appears", () => {
    const idleQueries = [
      "I need help with",
      "I need someone to fix my",
      "my",
      "the",
      "necesito ayuda con",
      "necesito que me arreglen el",
      "quiero",
      "도움이 필요해요",
      "수리",
      "수리해 주세요"
    ];
    for (const query of idleQueries) {
      const result = searchServices(query, "en");
      expect(result.status, query).toBe("idle");
      expect(result.empty, query).toBe(false);
      expect(Object.values(result.trades).every((tier) => tier === "idle"), query).toBe(true);
    }

    const toilet = searchServices("I need help with my toilet", "en");
    expect(toilet.status).toBe("hit");
    expect(toilet.empty).toBe(false);
    expect(toilet.trades.plumbing).toBe("strong");
    expect(toilet.trades.painting).toBe("soft");
    expect(toilet.trades.electrical).toBe("soft");
    expect(toilet.chips.some((chip) => chip.taskId === "FIXX-PLM-001" && chip.title === "Toilet repair")).toBe(true);

    const bars = searchServices("necesito ayuda con las protecciones", "en");
    expect(bars.trades.metalwork).toBe("strong");
    expect(bars.trades.locksmith).toBe("soft");
    expect(bars.chips[0]?.title.startsWith("Window security bars")).toBe(true);
    expect(bars.chips[0]?.tradeName).toBe("Metalwork");
    expect(bars.empty).toBe(false);

    const korean = searchServices("도움이 필요해요 변기", "ko");
    expect(korean.trades.plumbing).toBe("strong");
    expect(korean.empty).toBe(false);
    expect(korean.chips.some((chip) => chip.taskId === "FIXX-PLM-001" && chip.title === "변기 수리")).toBe(true);

    const particle = searchServices("변기를 고쳐주세요", "ko");
    expect(particle.trades.plumbing).toBe("strong");
    expect(particle.chips.some((chip) => chip.taskId === "FIXX-PLM-001")).toBe(true);
  });

  it("keeps the grid when any token hits, and ignores words that match nothing", () => {
    const weird = searchServices("my blue plumbing thing is weird", "en");
    expect(weird.empty).toBe(false);
    expect(weird.status).toBe("hit");
    expect(weird.trades.plumbing).toBe("strong");
    expect(weird.trades.painting).toBe("dim");
    expect(weird.trades.electrical).toBe("dim");

    const mixed = searchServices("toilet xyzzzz please", "es");
    expect(mixed.empty).toBe(false);
    expect(mixed.trades.plumbing).toBe("strong");
    expect(mixed.chips.some((chip) => chip.taskId === "FIXX-PLM-001")).toBe(true);

    const hvac = searchServices("no enfría", "en");
    expect(hvac.trades.hvac).toBe("strong");
    expect(hvac.empty).toBe(false);
  });

  it("covers every trade and every catalog job, and marks Korean wording as a draft", () => {
    expect(koreanSynonymStatus).toEqual({ status: "draft", needsNativeReview: true });
    const known = new Set(categories.map((category) => category.id));
    const listedTrades = new Set(tradeSynonyms.map((entry) => entry.tradeId));
    for (const id of known) expect(listedTrades.has(id), id).toBe(true);
    const listedJobs = new Set(tradeSynonyms.flatMap((entry) => entry.jobs ?? []));
    for (const job of catalogJobRecords()) expect(listedJobs.has(job.id), job.id).toBe(true);
    for (const room of rooms) {
      for (const id of [...room.trades, ...(room.strong ?? [])]) expect(known.has(id), `${room.id}:${id}`).toBe(true);
    }
  });

  it("lights the trades that work in a living room, softer than a direct word", () => {
    const living = searchServices("I need help with my living room", "en");
    expect(living.status).toBe("hit");
    expect(living.empty).toBe(false);
    const expected = ["painting", "flooring", "electrical", "hvac", "handyman", "carpentry", "cleaning", "pest_control", "appliance"];
    for (const id of expected) expect(living.trades[id], id).toBe("soft");
    expect(Object.values(living.trades).filter((tier) => tier === "strong" || tier === "soft").length).toBeGreaterThanOrEqual(4);
    expect(living.trades.locksmith).toBe("dim");
    expect(living.trades.plumbing).toBe("dim");
    expect(living.chips.length).toBeGreaterThan(0);
    expect(living.chips.length).toBeLessThanOrEqual(3);
    expect(living.chips.every((chip) => chip.categoryId === "painting")).toBe(true);
  });

  it("lights plumbing for a restroom and does not treat a storey as flooring", () => {
    const rest = searchServices("I need help with my restroom on the second floor", "en");
    expect(rest.status).toBe("hit");
    expect(rest.trades.plumbing).toBe("strong");
    expect(rest.trades.electrical).toBe("soft");
    expect(rest.trades.handyman).toBe("soft");
    expect(rest.trades.flooring).toBe("soft");
    expect(rest.trades.painting).toBe("soft");
    expect(rest.trades.cleaning).toBe("soft");
    // The word "floor" adds nothing: the same bathroom glow, and no flooring chip.
    expect(searchServices("restroom", "en").trades.flooring).toBe(rest.trades.flooring);
    expect(searchServices("restroom", "en").trades.cleaning).toBe(rest.trades.cleaning);
    expect(rest.chips.length).toBeLessThanOrEqual(3);
    expect(rest.chips.every((chip) => chip.categoryId === "plumbing")).toBe(true);
    expect(rest.chips.some((chip) => chip.categoryId === "flooring")).toBe(false);

    for (const query of ["second floor", "segundo piso", "2층", "planta alta", "upstairs"]) {
      const storey = searchServices(query, "en");
      expect(storey.status, query).toBe("idle");
      expect(storey.empty, query).toBe(false);
      expect(storey.trades.flooring, query).toBe("idle");
    }
    expect(searchServices("floor", "en").trades.flooring).toBe("strong");
    expect(searchServices("floor", "en").trades.cleaning).not.toBe("strong");
    expect(searchServices("piso", "es").trades.flooring).toBe("strong");
    const upstairs = searchServices("2층 화장실", "ko");
    expect(upstairs.trades.plumbing).toBe("strong");
    expect(upstairs.trades.flooring).not.toBe("strong");
  });

  it("matches bathroom, climate, power, and roof words in everyday language", () => {
    const bano = searchServices("baño", "es");
    expect(bano.trades.plumbing).toBe("strong");
    expect(bano.trades.flooring).toBe("soft");
    expect(bano.trades.concrete).toBe("dim");
    expect(bano.chips.every((chip) => chip.categoryId === "plumbing")).toBe(true);

    expect(searchServices("my AC is too hot", "en").trades.hvac).toBe("strong");
    expect(searchServices("my AC is too hot", "en").trades.metalwork).toBe("dim");
    expect(searchServices("el clima no enfría", "es").trades.hvac).toBe("strong");
    expect(searchServices("a/c", "en").trades.hvac).toBe("strong");

    const luz = searchServices("no hay luz", "es");
    expect(luz.trades.electrical).toBe("strong");
    expect(luz.chips.some((chip) => chip.taskId === "FIXX-ELC-002")).toBe(true);

    const gotera = searchServices("gotera", "es");
    expect(gotera.trades.roofing).toBe("strong");
    expect(gotera.trades.plumbing).toBe("soft");
    expect(gotera.chips[0]?.categoryId).toBe("roofing");

    expect(searchServices("화장실", "ko").trades.plumbing).toBe("strong");
    expect(searchServices("욕실 수리해 주세요", "ko").trades.plumbing).toBe("strong");
    expect(searchServices("taza", "es").trades.plumbing).toBe("strong");
    expect(searchServices("regadera", "es").trades.plumbing).toBe("strong");
    expect(searchServices("zancudos", "es").trades.pest_control).toBe("strong");
    expect(searchServices("apagador", "es").trades.electrical).toBe("strong");
    expect(searchServices("calentador", "es").trades.plumbing).toBe("strong");
    expect(searchServices("squeaky door", "en").trades.carpentry).toBe("strong");

    expect(searchServices("zzzz", "en")).toMatchObject({ empty: true, status: "empty", tradeCount: 0 });
    const filler = searchServices("I need help with", "en");
    expect(filler.status).toBe("idle");
    expect(filler.empty).toBe(false);
    expect(Object.values(filler.trades).every((tier) => tier === "idle")).toBe(true);
    expect(searchServices("lavar", "es").trades.cleaning).toBe("strong");
    expect(searchServices("lavar", "es").trades.appliance).not.toBe("strong");
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
    expect(screen.getByRole("button", { name: "Add Painting" }).closest("li")?.getAttribute("data-match")).toBe("soft");
    const drain = screen.getByRole("button", { name: /Drain cleaning/ });
    expect(drain.textContent).toContain("Plumbing");
    fireEvent.click(drain);
    expect(jobs).toEqual(["plumbing:FIXX-PLM-006"]);
    expect(screen.getByText("6 trades match · 2 jobs suggested")).toBeTruthy();

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

  function typeAndWait(value: string) {
    fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
    act(() => { vi.advanceTimersByTime(150); });
  }

  it("does not hide the grid for a single letter, a short prefix, or filler wording", () => {
    const { jobs } = renderHome();
    typeAndWait("a");
    expect(screen.queryByRole("heading", { name: "No matching services" })).toBeNull();
    expect(screen.queryByText("No matches")).toBeNull();
    expect(screen.getByRole("heading", { name: "Choose a service" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBeNull();

    typeAndWait("p");
    expect(screen.queryByText("No matches")).toBeNull();
    expect(screen.getByRole("button", { name: "Add Metalwork" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBeNull();

    typeAndWait("plom");
    expect(screen.queryByRole("heading", { name: "No matching services" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBe("strong");
    expect(screen.getByRole("button", { name: "Add Painting" }).closest("li")?.getAttribute("data-match")).toBe("dim");
    expect(screen.getByRole("button", { name: "Add Painting" })).toBeTruthy();

    typeAndWait("I need help with");
    expect(screen.queryByText("No matches")).toBeNull();
    expect(screen.queryByRole("heading", { name: "No matching services" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Choose a service" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBeNull();

    typeAndWait("I need help with my toilet");
    expect(screen.queryByRole("heading", { name: "No matching services" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBe("strong");
    expect(screen.getByRole("button", { name: "Add Electrical" }).closest("li")?.getAttribute("data-match")).toBe("soft");
    const toilet = screen.getByRole("button", { name: /Toilet repair/ });
    expect(toilet.textContent).toContain("Plumbing");
    fireEvent.click(toilet);
    expect(jobs).toEqual(["plumbing:FIXX-PLM-001"]);

    typeAndWait("my blue plumbing thing is weird");
    expect(screen.queryByText("No matches")).toBeNull();
    expect(screen.getByRole("button", { name: "Add Plumbing" }).closest("li")?.getAttribute("data-match")).toBe("strong");
    expect(screen.getByRole("button", { name: "Add Painting" })).toBeTruthy();

    typeAndWait("zzzz");
    expect(screen.getByRole("heading", { name: "No matching services" })).toBeTruthy();
    expect(screen.getByText("No matches")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Plumbing" })).toBeNull();
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
