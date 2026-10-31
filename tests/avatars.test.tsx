/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { colors } from "../src/ui/tokens";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { AVATARS, DEFAULT_AVATAR_ID, resetAvatar } from "../src/features/customer/avatarChoice";
import { setDemoMode } from "../src/features/customer/demoMode";
import { resetHomeProfile } from "../src/features/customer/homeProfile";
import { resetSession, session } from "../src/features/customer/session";

function badgeFill(id: string): string | null {
  return document.querySelector(`[data-avatar="${id}"] [data-badge-fill]`)?.getAttribute("fill") ?? null;
}

describe("profile avatars", () => {
  beforeEach(async () => {
    resetHomeProfile();
    resetAvatar();
    setDemoMode(false);
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    resetAvatar();
    setDemoMode(false);
    resetHomeProfile();
    runtime.reset();
    resetSession(false);
    await i18n.changeLanguage("en");
  });

  it("offers eight labeled radios, defaults to a middle-aged man, and saves the choice", () => {
    render(<CustomerApp />);
    const radios = screen.getAllByRole("radio", { name: /man|woman/i });
    expect(radios.map((radio) => (radio as HTMLInputElement).value).sort()).toEqual(AVATARS.map((avatar) => avatar.id).sort());
    expect((screen.getByRole("radio", { name: "Middle-aged man" }) as HTMLInputElement).checked).toBe(true);
    expect(DEFAULT_AVATAR_ID).toBe("middle-man");
    expect(screen.getByTestId("header-avatar").querySelector("svg")?.getAttribute("data-avatar")).toBe("middle-man");

    const men = ["young-man", "middle-man", "bald-man", "beard-glasses", "cap-man"];
    const women = ["young-woman", "middle-woman", "long-hair"];
    men.forEach((id) => expect(badgeFill(id)).toBe(colors.avatarLime));
    women.forEach((id) => expect(badgeFill(id)).toBe(colors.avatarPink));
    expect(document.querySelector("[data-avatar]")?.outerHTML ?? "").not.toMatch(/#fff(?:fff)?\b/i);

    fireEvent.click(screen.getByRole("radio", { name: "Woman with long hair" }));
    expect((screen.getByRole("radio", { name: "Woman with long hair" }) as HTMLInputElement).checked).toBe(true);
    expect(localStorage.getItem("fixx.profileAvatar")).toBe("long-hair");
    expect(screen.getByTestId("header-avatar").querySelector("svg")?.getAttribute("data-avatar")).toBe("long-hair");
    expect(screen.getByText("Profile picture: Woman with long hair")).toBeTruthy();
  });

  it("keeps the Korean avatar labels as a draft", async () => {
    const ko = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/ko/cases.json"), "utf8")) as Record<string, { status: string; needsNativeReview?: boolean; text: string }>;
    for (const avatar of AVATARS) {
      expect(ko[avatar.labelKey]?.status).toBe("draft");
      expect(ko[avatar.labelKey]?.needsNativeReview).toBe(true);
    }
    expect(ko["avatar.legend"]?.needsNativeReview).toBe(true);
    await i18n.changeLanguage("ko");
    render(<CustomerApp />);
    expect(screen.getByRole("radio", { name: "긴 머리 여성" })).toBeTruthy();
    expect(screen.getByText("한국어 문구는 초안이에요.")).toBeTruthy();
  });
});
