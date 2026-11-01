/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { resetDemoMode } from "../src/features/customer/demoMode";
import { resetHomeProfile } from "../src/features/customer/homeProfile";
import { resetSession, session } from "../src/features/customer/session";
import { resetTheme } from "../src/ui/theme";

function installMatchMedia(dark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? dark : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; }
  })) as unknown as typeof window.matchMedia;
}

describe("color theme", () => {
  beforeEach(async () => {
    resetTheme();
    resetHomeProfile();
    resetDemoMode();
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    resetTheme();
    resetDemoMode();
    resetHomeProfile();
    runtime.reset();
    resetSession(false);
    await i18n.changeLanguage("en");
  });

  it("follows the system preference until someone chooses", () => {
    installMatchMedia(true);
    resetTheme();
    render(<CustomerApp />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("fixx.theme")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Switch to light theme" });
    expect(toggle.className).toContain("min-h-[44px]");
    expect(toggle.className).toContain("min-w-[44px]");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("saves the My Home choice and keeps it over the system preference", () => {
    installMatchMedia(false);
    resetTheme();
    render(<CustomerApp />);
    const toggle = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(toggle.className).toContain("min-h-[44px]");
    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("fixx.theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("fixx.theme")).toBe("light");
  });
});
