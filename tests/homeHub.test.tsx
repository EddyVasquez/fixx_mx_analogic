/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { jobMachine, newJobCtx, newWarranty, warrantyMachine } from "../src/core/machines";
import { colors } from "../src/ui/tokens";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { setDemoMode } from "../src/features/customer/demoMode";
import { resetHomeProfile } from "../src/features/customer/homeProfile";
import { JOB_ID, resetSession, session } from "../src/features/customer/session";

const HUB_FILES = [
  "src/features/customer/MyHomeTab.tsx",
  "src/features/customer/blueprint/houseModel.ts",
  "src/features/customer/blueprint/BlueprintFallback.tsx",
  "src/features/customer/blueprint/BlueprintSlot.tsx",
  "src/features/customer/blueprint/HouseBlueprint.tsx"
];

function modules(): string[] {
  return [...document.querySelectorAll("[data-module]")].map((el) => el.getAttribute("data-module") ?? "");
}

describe("My Home hub", () => {
  beforeEach(async () => {
    resetHomeProfile();
    setDemoMode(false);
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    session.email = "eduardo@example.com";
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    setDemoMode(false);
    resetHomeProfile();
    runtime.reset();
    resetSession(false);
    await i18n.changeLanguage("en");
  });

  it("does not read payout fields and keeps the accent off text and icons", () => {
    for (const file of HUB_FILES) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(/payoutRatio|heldPayout|releasedPayout/);
      expect(src).not.toMatch(/text-accent/);
      expect(src).not.toMatch(/#DFFF32/i);
      expect(src).not.toMatch(/\b(margin|commission)\b/i);
    }
    const tab = readFileSync(join(process.cwd(), "src/features/customer/MyHomeTab.tsx"), "utf8");
    expect(tab).not.toMatch(/from ["']three["']/);
    expect(tab).not.toMatch(/HouseBlueprint/);
    const slot = readFileSync(join(process.cwd(), "src/features/customer/blueprint/BlueprintSlot.tsx"), "utf8");
    expect(slot).toMatch(/import\("\.\/HouseBlueprint"\)/);
    const live = readFileSync(join(process.cwd(), "src/features/customer/blueprint/HouseBlueprint.tsx"), "utf8");
    expect(live).toMatch(/EdgesGeometry/);
    expect(colors.accent).toBe("#DFFF32");
  });

  it("lays the real modules out in phone order, with example tags only on placeholders", () => {
    render(<CustomerApp />);
    expect(modules()).toEqual(["hero", "active", "warranty", "maintenance", "documents", "history", "details", "demo"]);
    const hero = screen.getByRole("region", { name: "Eduardo L. Vasquez" });
    expect(hero.className).toContain("lg:col-span-12");
    expect(hero.className).not.toContain("home-hero");
    expect(hero.className).not.toContain("bg-accent");
    expect(document.querySelector("[data-module='active']")?.className).toContain("lg:col-span-4");
    expect(document.querySelector("[data-module='active']")?.className).toContain("lg:col-start-1");
    expect(document.querySelector("[data-module='warranty']")?.className).toContain("lg:col-start-5");
    expect(document.querySelector("[data-module='maintenance']")?.className).toContain("lg:col-start-9");
    expect(document.querySelector("[data-module='documents']")?.className).toContain("lg:col-start-9");
    expect(document.querySelector("[data-module='details']")?.className).toContain("lg:col-span-8");
    expect(document.querySelector("[data-module='history']")?.className).toContain("lg:col-span-4");
    expect(document.querySelector("[data-module='demo']")?.className).toContain("lg:col-span-12");
    expect(document.querySelector("[data-module='active'] .home-outline-badge, [data-module='active'] input")).toBeNull();

    const tiles = [...hero.querySelectorAll(".home-readout")];
    expect(tiles).toHaveLength(6);
    expect(tiles.map((tile) => tile.getAttribute("data-fact"))).toEqual(["stories", "built", "bedrooms", "bathrooms", "minisplits", "garage"]);
    tiles.forEach((tile) => {
      expect(tile.getAttribute("aria-pressed")).toBe("false");
      const icon = tile.querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      expect(icon?.getAttribute("width")).toBe("22");
      expect(icon?.getAttribute("fill")).toBe(colors.ink);
    });
    expect(tiles[1]?.textContent).toContain("100.49");
    expect(tiles[1]?.textContent).toContain("m²");
    expect(tiles[5]?.getAttribute("aria-label")).toBe("Garage 1–2");
    expect(tiles[5]?.textContent).toContain("1–2");
    expect(within(hero).queryByText("Get help with")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Sample home data" }).closest("[data-module='demo']")).toBeTruthy();
    expect(within(hero).queryByText("Example")).toBeNull();
    expect(screen.getAllByText("Example")).toHaveLength(4);
    expect(screen.getAllByText("Example only. Nothing here is scheduled for your home yet.")).toHaveLength(2);
    expect(screen.getByText("Your quotes, receipts and warranty papers will appear here.")).toBeTruthy();
    expect(screen.getByText("No active jobs. Need something fixed?")).toBeTruthy();
    expect(screen.getByText("No completed jobs yet. Your service history builds up here.")).toBeTruthy();
    expect(screen.getByText("Warranty starts when a job is finished.")).toBeTruthy();
    expect(document.querySelector("[data-blueprint='fallback']")?.getAttribute("alt")).toBe("Blueprint of your home. Drag or use arrow keys to turn it.");
    expect(screen.getByText(/Updated /)).toBeTruthy();
    const css = readFileSync(join(process.cwd(), "src/features/customer/homeGlass.css"), "utf8");
    expect(css).not.toMatch(/\.home-hero/);
    expect(css).toMatch(/\.home-readout\[aria-pressed="true"\]/);
  });

  it("selects one readout at a time and announces the space", () => {
    render(<CustomerApp />);
    const garage = document.querySelector<HTMLButtonElement>('[data-fact="garage"]')!;
    fireEvent.click(garage);
    expect(garage.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".cockpit-callout")?.textContent).toBe("Garage for 1–2 cars");
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-fact="bedrooms"]')!);
    expect(garage.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(".cockpit-callout")?.textContent).toBe("Bedrooms 3");
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-fact="bedrooms"]')!);
    expect(document.querySelector(".cockpit-callout")).toBeNull();
    fireEvent.click(garage);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(garage.getAttribute("aria-pressed")).toBe("false");
  });

  it("starts the Request tab with no trade selected, including after a refresh", () => {
    localStorage.setItem("fixx.draft", JSON.stringify({ categoryId: "painting" }));
    sessionStorage.setItem("fixx.draft", JSON.stringify({ categoryId: "painting" }));
    session.draft = { ...session.draft, categoryId: "painting" };
    resetSession(true);
    expect(session.draft.categoryId).toBe("");
    session.signedIn = true;
    session.tab = "request";
    render(<CustomerApp />);
    expect(screen.queryByRole("region", { name: "Get help with" })).toBeNull();
    expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
    const painting = screen.getByRole("button", { name: "Add Painting" });
    expect(painting.getAttribute("aria-pressed")).not.toBe("true");
    expect(painting.querySelector("svg")?.getAttribute("data-icon")).toBe("plus");
    expect(painting.closest("li")?.getAttribute("data-selected")).not.toBe("true");
    expect(painting.closest("li")?.className).not.toContain("bg-accent");
    localStorage.removeItem("fixx.draft");
    sessionStorage.removeItem("fixx.draft");
  });

  it("opens Request from My Home without a trade already chosen", () => {
    render(<CustomerApp />);
    expect(screen.queryByRole("heading", { name: "Get help with" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(session.tab).toBe("request");
    expect(session.draft.categoryId).toBe("");
    expect(screen.getByRole("heading", { name: "Choose a service" })).toBeTruthy();
    expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
  });

  it("opens a request for a real category, and leaves maintenance as an example", () => {
    session.tab = "request";
    render(<CustomerApp />);
    const names = ["Plumbing", "Electrical", "HVAC", "Painting", "Pest control", "Gardening", "Flooring", "Concrete", "Carpentry", "Appliance repair", "Roofing", "Handyman", "Locksmith", "Cleaning", "Metalwork"];
    expect(screen.getAllByRole("button").filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("Add ")).map((button) => button.getAttribute("aria-label"))).toEqual(names.map((name) => `Add ${name}`));
    names.forEach((name) => expect(screen.getByText(name)).toBeTruthy());
    expect(screen.queryByRole("link", { name: "See all services" })).toBeNull();
    const plumbing = screen.getByRole("button", { name: "Add Plumbing" });
    expect(plumbing.className).toContain("min-h-touch");
    expect(plumbing.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Add Electrical" }));
    expect(session.draft.categoryId).toBe("electrical");
    expect(screen.getByRole("heading", { name: "Tell us about the job" })).toBeTruthy();
    const selectedTrade = screen.getByRole("button", { name: "Add Electrical" });
    expect(selectedTrade.getAttribute("aria-pressed")).toBe("true");
    expect(selectedTrade.querySelector("svg")?.getAttribute("data-icon")).toBe("check");
    expect(selectedTrade.closest("li")?.getAttribute("data-selected")).toBe("true");
    expect(selectedTrade.closest("li")?.className).toContain("bg-accent");
    const unselectedTrade = screen.getByRole("button", { name: "Add Plumbing" });
    expect(unselectedTrade.getAttribute("aria-pressed")).toBe("false");
    expect(unselectedTrade.querySelector("svg")?.getAttribute("data-icon")).toBe("plus");
    expect(unselectedTrade.closest("li")?.className).not.toContain("bg-accent");

    cleanup();
    resetSession(false);
    session.signedIn = true;
    render(<CustomerApp />);
    const maintenance = screen.getByRole("region", { name: "Maintenance ideas" });
    expect(within(maintenance).getByText(/Clean minisplit filters/)).toBeTruthy();
    fireEvent.click(within(maintenance).getByRole("button", { name: "Add HVAC" }));
    expect(session.draft.categoryId).toBe("hvac");
    expect(screen.getByRole("heading", { name: "Tell us about the job" })).toBeTruthy();
  });

  it("shows a pending-review badge and centavos, never a booked label", () => {
    session.draft = { ...session.draft, categoryId: "electrical" };
    session.proId = "p3";
    runtime.spawn(JOB_ID, "job", jobMachine, newJobCtx({ total: 1800.5, professionalId: "p3", needsReview: true }), { categoryId: "electrical" }, "pendingReview");
    render(<CustomerApp />);
    const badge = screen.getByText("Pending review");
    expect(badge.className).toContain("home-outline-badge");
    expect(badge.className).not.toContain("warnAmber");
    expect(badge.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("Total: $1,800.50 MXN")).toBeTruthy();
    expect(screen.getByText("Electrical with Jorge Salinas")).toBeTruthy();
    expect(screen.queryByText(/booked/i)).toBeNull();
    expect(screen.queryByText("Example", { selector: "[data-module='active'] *" })).toBeNull();
  });

  it("shows the amount still due with centavos", () => {
    session.proId = "p2";
    const jobStart = new Date("2026-11-02T15:00:00-06:00");
    runtime.spawn(JOB_ID, "job", jobMachine, newJobCtx({ total: 1250, initialDue: 250, paid: 0, professionalId: "p2", jobStart }), { categoryId: "painting" }, "awaitingDeposit");
    render(<CustomerApp />);
    expect(screen.getByText("Amount due: $250.00 MXN")).toBeTruthy();
    expect(screen.getByText("Quote accepted")).toBeTruthy();
    expect(screen.queryByText(/booked/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View job" }));
    expect(session.tab).toBe("request");
  });

  it("computes warranty days from the runtime clock and opens the warranty tab", () => {
    const start = runtime.clock.now();
    runtime.spawn(`warranty:${JOB_ID}`, "warranty", warrantyMachine, newWarranty(start, "painting"), { jobId: JOB_ID });
    render(<CustomerApp />);
    const ctx = runtime.get(`warranty:${JOB_ID}`)!.snap.ctx as { endsAt: Date };
    const days = Math.max(Math.ceil((ctx.endsAt.getTime() - runtime.clock.now().getTime()) / 86_400_000), 0);
    expect(screen.getByText(`${days} days left`)).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Warranty" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    act(() => { runtime.advanceHours(24); });
    const later = Math.max(Math.ceil((ctx.endsAt.getTime() - runtime.clock.now().getTime()) / 86_400_000), 0);
    expect(later).toBe(days - 1);
    expect(screen.getByText(`${later} days left`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open warranty" }));
    expect(session.tab).toBe("warranty");
    expect(screen.getByRole("heading", { name: "Warranty" })).toBeTruthy();
  });

  it("puts a finished job in history and translates the hub", async () => {
    session.proId = "p2";
    runtime.spawn(JOB_ID, "job", jobMachine, newJobCtx({ total: 1250, professionalId: "p2" }), { categoryId: "painting" }, "paymentReleased");
    render(<CustomerApp />);
    expect(screen.getByText("Painting with Marisol Treviño")).toBeTruthy();
    expect(screen.getByText("Total: $1,250.00 MXN")).toBeTruthy();
    expect(screen.getByText("No active jobs. Need something fixed?")).toBeTruthy();

    const ko = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/ko/cases.json"), "utf8")) as Record<string, { status: string; needsNativeReview?: boolean }>;
    const hubKeys = Object.keys(ko).filter((key) => key.startsWith("myhome.hub."));
    expect(hubKeys.length).toBeGreaterThan(10);
    for (const key of hubKeys) {
      expect(ko[key]?.status).toBe("draft");
      expect(ko[key]?.needsNativeReview).toBe(true);
    }

    await i18n.changeLanguage("es");
    expect(screen.getByRole("heading", { name: "Trabajo en curso" })).toBeTruthy();
    expect(screen.getByText("No tienes trabajos en curso. ¿Necesitas arreglar algo?")).toBeTruthy();
    expect(screen.getByText("Total: $1,250.00 MXN")).toBeTruthy();
    expect(screen.getAllByText("Ejemplo").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-blueprint='fallback']")?.getAttribute("alt")).toBe("Plano de tu casa. Arrástralo o usa las flechas para girarlo.");

    await i18n.changeLanguage("ko");
    expect(screen.getByText("한국어 문구는 초안이에요.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "진행 중인 작업" })).toBeTruthy();
    expect(screen.getByText("진행 중인 작업이 없어요. 고칠 게 있나요?")).toBeTruthy();
  });
});

describe("blueprint folder stays free of three on the static path", () => {
  it("keeps the 3D module behind the lazy import only", () => {
    const dir = join(process.cwd(), "src/features/customer/blueprint");
    const eager = readdirSync(dir).filter((name) => name !== "HouseBlueprint.tsx" && name !== "houseHighlight.ts");
    const slot = readFileSync(join(dir, "BlueprintSlot.tsx"), "utf8");
    expect(slot).not.toMatch(/houseHighlight/);
    for (const name of eager) {
      const src = readFileSync(join(dir, name), "utf8");
      expect(src).not.toMatch(/from ["']three["']/);
      expect(src).not.toMatch(/@react-three\/fiber/);
    }
  });
});
