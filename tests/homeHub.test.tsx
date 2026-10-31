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
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    session.email = "eduardo@example.com";
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
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
    expect(modules()).toEqual(["hero", "active", "quick", "warranty", "maintenance", "details", "history", "documents"]);
    const hero = screen.getByRole("region", { name: "Eduardo L. Vasquez" });
    expect(hero.className).toContain("lg:col-span-8");
    expect(hero.className).toContain("bg-accent");
    expect(document.querySelector("[data-module='active']")?.className).toContain("lg:col-span-4");
    expect(document.querySelector("[data-module='active']")?.className).toContain("lg:col-start-9");
    expect(document.querySelector("[data-module='warranty']")?.className).toContain("md:col-start-4");
    expect(document.querySelector("[data-module='quick']")?.className).toContain("lg:col-span-8");
    expect(document.querySelector("[data-module='documents']")?.className).toContain("lg:col-span-6");
    expect(document.querySelector("[data-module='history']")?.className).toContain("lg:col-span-4");

    const values = [...hero.querySelectorAll("dd")].map((dd) => dd.textContent);
    expect(values).toEqual(["2", "100.49 m²", "3", "2", "1", "1–2"]);
    hero.querySelectorAll("dl svg").forEach((icon) => {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("fill")).toBe(colors.ink);
    });
    expect(within(hero).queryByText("Example")).toBeNull();
    expect(screen.getAllByText("Example")).toHaveLength(4);
    expect(screen.getAllByText("Example only. Nothing here is scheduled for your home yet.")).toHaveLength(2);
    expect(screen.getByText("Your quotes, receipts and warranty papers will appear here.")).toBeTruthy();
    expect(screen.getByText("No active jobs. Need something fixed?")).toBeTruthy();
    expect(screen.getByText("No completed jobs yet. Your service history builds up here.")).toBeTruthy();
    expect(screen.getByText("Warranty starts when a job is finished.")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Blueprint of your home. Drag or use arrow keys to turn it." })).toBeTruthy();
    expect(screen.getByText(/Updated /)).toBeTruthy();
  });

  it("opens a request for a real category, and leaves maintenance as an example", () => {
    render(<CustomerApp />);
    const quick = screen.getByRole("region", { name: "Get help with" });
    const names = within(quick).getAllByRole("button").map((button) => button.textContent);
    expect(names).toEqual(["Plumbing", "Electrical", "HVAC", "Cleaning", "Handyman", "Locksmith"]);
    fireEvent.click(within(quick).getByRole("button", { name: "Electrical" }));
    expect(session.draft.categoryId).toBe("electrical");
    expect(screen.getByRole("heading", { name: "Tell us about the job" })).toBeTruthy();
    expect((screen.getByLabelText("Service") as HTMLSelectElement).value).toBe("electrical");

    cleanup();
    resetSession(false);
    session.signedIn = true;
    render(<CustomerApp />);
    fireEvent.click(screen.getByRole("link", { name: "See all services" }));
    expect(screen.getByRole("heading", { name: "What do you need to do at home?" })).toBeTruthy();

    cleanup();
    resetSession(false);
    session.signedIn = true;
    render(<CustomerApp />);
    fireEvent.click(screen.getByRole("button", { name: /Clean minisplit filters/ }));
    expect(session.draft.categoryId).toBe("hvac");
    expect(screen.getByRole("heading", { name: "Tell us about the job" })).toBeTruthy();
  });

  it("shows a pending-review badge and centavos, never a booked label", () => {
    session.draft = { ...session.draft, categoryId: "electrical" };
    session.proId = "p3";
    runtime.spawn(JOB_ID, "job", jobMachine, newJobCtx({ total: 1800.5, professionalId: "p3", needsReview: true }), { categoryId: "electrical" }, "pendingReview");
    render(<CustomerApp />);
    const badge = screen.getByText("Pending review");
    expect(badge.className).toContain("bg-warnAmberBg");
    expect(badge.className).toContain("text-warnAmberInk");
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
    expect(screen.getByRole("img", { name: "Plano de tu casa. Arrástralo o usa las flechas para girarlo." })).toBeTruthy();

    await i18n.changeLanguage("ko");
    expect(screen.getByText("한국어 문구는 초안이에요.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "진행 중인 작업" })).toBeTruthy();
    expect(screen.getByText("진행 중인 작업이 없어요. 고칠 게 있나요?")).toBeTruthy();
  });
});

describe("blueprint folder stays free of three on the static path", () => {
  it("keeps the 3D module behind the lazy import only", () => {
    const dir = join(process.cwd(), "src/features/customer/blueprint");
    const eager = readdirSync(dir).filter((name) => name !== "HouseBlueprint.tsx");
    for (const name of eager) {
      const src = readFileSync(join(dir, name), "utf8");
      expect(src).not.toMatch(/from ["']three["']/);
      expect(src).not.toMatch(/@react-three\/fiber/);
    }
  });
});
