/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { contrast } from "../src/core/rules/contrast";
import { colors } from "../src/ui/tokens";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { TAB_BAR_BG, TAB_INACTIVE } from "../src/features/customer/CustomerTabBar";
import { getHomeProfile, resetHomeProfile, setHomeProfile } from "../src/features/customer/homeProfile";
import { CUSTOMER_TAB_ORDER, emptyDraft, resetSession, session } from "../src/features/customer/session";

const seedProfile = {
  homeownerName: "Eduardo L. Vasquez",
  community: "Santa Sofia Residencial",
  address: "Sierra Picachos 402"
};

function tabLinks() {
  return within(screen.getByRole("navigation")).getAllByRole("link");
}

function tabLabels(): string[] {
  return tabLinks().map((link) => link.textContent ?? "");
}

describe("My Home tab and request prefill", () => {
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

  it("loads one demo seed profile into new requests", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "src/seed/demoProfile.json"), "utf8")) as typeof seedProfile;
    expect(raw).toEqual(seedProfile);
    expect(getHomeProfile()).toEqual(seedProfile);
    const draft = emptyDraft();
    expect(draft.homeownerName).toBe(seedProfile.homeownerName);
    expect(draft.community).toBe(seedProfile.community);
    expect(draft.street).toBe(seedProfile.address);
    expect(CUSTOMER_TAB_ORDER).toEqual(["home", "request", "warranty", "help"]);
  });

  it("opens on My Home, with Request and Warranty next and Help after them", () => {
    render(<CustomerApp />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const tabs = within(nav).getAllByRole("link");
    expect(tabLabels()).toEqual(["My Home", "Request", "Warranty", "Help"]);
    expect(CUSTOMER_TAB_ORDER).toEqual(["home", "request", "warranty", "help"]);
    expect(tabs[0]?.getAttribute("aria-current")).toBe("page");
    expect(tabs.slice(1).every((link) => link.getAttribute("aria-current") == null)).toBe(true);
    expect(screen.queryByRole("link", { name: "My jobs" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Messages" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
    const icons = nav.querySelectorAll("svg");
    expect(icons).toHaveLength(4);
    icons.forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
    expect(icons[0]?.getAttribute("data-weight")).toBe("fill");
    expect(icons[0]?.getAttribute("width")).toBe("24");
    expect(icons[0]?.getAttribute("fill")).toBe(colors.brand);
    expect(icons[1]?.getAttribute("data-weight")).toBe("regular");
    expect(icons[1]?.getAttribute("fill")).toBe(TAB_INACTIVE);
    tabs.forEach((link) => expect(link.className).toContain("flex-1"));
    expect(contrast(TAB_INACTIVE, TAB_BAR_BG)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByRole("heading", { name: "My Home" })).toBeTruthy();
    expect(screen.getByText("Homeowner: Eduardo L. Vasquez")).toBeTruthy();
    expect(screen.getByText("Community: Santa Sofia Residencial")).toBeTruthy();
    expect(screen.getByText("Address: Sierra Picachos 402")).toBeTruthy();

    fireEvent.click(tabs[1]!);
    const next = within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link");
    expect(next[1]?.getAttribute("aria-current")).toBe("page");
    expect(next[0]?.getAttribute("aria-current")).toBeNull();
    expect(next[2]?.getAttribute("aria-current")).toBeNull();

    const help = within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Help" });
    expect(help.querySelector("svg")?.getAttribute("data-icon")).toBe("help");
    expect(help.querySelector("svg")?.getAttribute("data-weight")).toBe("regular");
    fireEvent.click(help);
    const helpIcon = within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Help" }).querySelector("svg");
    expect(helpIcon?.getAttribute("data-weight")).toBe("fill");
    expect(helpIcon?.getAttribute("data-icon")).toBe("help");
  });

  it("shows Spanish labels for the same profile", async () => {
    await i18n.changeLanguage("es");
    render(<CustomerApp />);
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeTruthy();
    expect(tabLabels()).toEqual(["Mi hogar", "Solicitar", "Garantía", "Ayuda"]);
    expect(tabLinks()[0]?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Propietario: Eduardo L. Vasquez")).toBeTruthy();
    expect(screen.getByText("Fraccionamiento: Santa Sofia Residencial")).toBeTruthy();
    expect(screen.getByText("Dirección: Sierra Picachos 402")).toBeTruthy();
  });

  it("reads My Home from the profile store, which registration can replace", () => {
    setHomeProfile({ homeownerName: "Ana Demo", community: "Valle Demo", address: "Calle Demo 1" });
    resetSession(false);
    session.signedIn = true;
    render(<CustomerApp />);
    expect(screen.getByText("Homeowner: Ana Demo")).toBeTruthy();
    expect(screen.getByText("Community: Valle Demo")).toBeTruthy();
    expect(screen.getByText("Address: Calle Demo 1")).toBeTruthy();
    expect(screen.queryByText(/Eduardo L\. Vasquez/)).toBeNull();
  });

  it("prefills name, community and address, and keeps edits on this request only", () => {
    render(<CustomerApp />);
    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Painting" }));

    const name = screen.getByLabelText("Your name") as HTMLInputElement;
    const community = screen.getByLabelText("Community") as HTMLInputElement;
    const street = screen.getByLabelText("Street and number") as HTMLInputElement;
    expect(name.value).toBe(seedProfile.homeownerName);
    expect(community.value).toBe(seedProfile.community);
    expect(street.value).toBe(seedProfile.address);
    expect(screen.getByText("These come from My Home. You can change them for this request.")).toBeTruthy();

    fireEvent.change(name, { target: { value: "Ana Demo" } });
    fireEvent.change(community, { target: { value: "Valle Demo" } });
    fireEvent.change(street, { target: { value: "Calle Demo 1" } });
    fireEvent.change(screen.getByLabelText(/What needs to be done/), { target: { value: "Paint the hall" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));
    expect(screen.getByText("Ana Demo")).toBeTruthy();
    expect(screen.getByText("Valle Demo")).toBeTruthy();
    expect(screen.getByText("Zone 1 (demo), Calle Demo 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "My Home" }));
    expect(screen.getByText("Homeowner: Eduardo L. Vasquez")).toBeTruthy();
    expect(screen.getByText("Community: Santa Sofia Residencial")).toBeTruthy();
    expect(screen.getByText("Address: Sierra Picachos 402")).toBeTruthy();
    expect(getHomeProfile()).toEqual(seedProfile);

    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Painting" }));
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Ana Demo");
    expect((screen.getByLabelText("Community") as HTMLInputElement).value).toBe("Valle Demo");
    expect((screen.getByLabelText("Street and number") as HTMLInputElement).value).toBe("Calle Demo 1");
  });
});
