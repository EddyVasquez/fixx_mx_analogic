/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { contrast } from "../src/core/rules/contrast";
import i18n from "../src/i18n";
import { runtime } from "../src/demo/runtime";
import { CustomerApp } from "../src/features/customer/CustomerApp";
import { TAB_ACTIVE, TAB_BAR_BG, TAB_INACTIVE } from "../src/features/customer/CustomerTabBar";
import { matchingAreaTier } from "../src/core/pricing/areaTier";
import { resetDemoMode } from "../src/features/customer/demoMode";
import { getHomeProfile, resetHomeProfile, setHomeProfile } from "../src/features/customer/homeProfile";
import { cleaningAreaTiers } from "../src/features/customer/homeModel";
import { CUSTOMER_TAB_ORDER, emptyDraft, resetSession, session } from "../src/features/customer/session";

const seedProfile = {
  homeownerName: "Eduardo L. Vasquez",
  community: "Santa Sofía Residencial",
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
    resetDemoMode();
    runtime.reset();
    resetSession(false);
    session.signedIn = true;
    session.email = "eduardo@example.com";
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    resetDemoMode();
    resetHomeProfile();
    runtime.reset();
    resetSession(false);
    await i18n.changeLanguage("en");
  });

  it("loads one demo seed profile into new requests", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "src/seed/demoProfile.json"), "utf8")) as typeof seedProfile & {
      model: { id: string; developer: string; stories: number; lotM2: number; builtM2: number; bedrooms: number; minisplits: number; groundFullBathrooms: number; upperFullBathrooms: number; plansVaryByPhase: boolean };
    };
    expect(raw).toMatchObject(seedProfile);
    expect(raw.model).toMatchObject({
      id: "santa-sofia",
      developer: "GP Vivienda",
      stories: 2,
      lotM2: 98,
      builtM2: 100.49,
      bedrooms: 3,
      minisplits: 1,
      groundFullBathrooms: 1,
      upperFullBathrooms: 1,
      plansVaryByPhase: true
    });
    expect(getHomeProfile()).toEqual(raw);
    const draft = emptyDraft();
    expect(draft.homeownerName).toBe(seedProfile.homeownerName);
    expect(draft.community).toBe(seedProfile.community);
    expect(draft.street).toBe(seedProfile.address);
    expect(draft.cleaningTier).toBe(matchingAreaTier(100.49, cleaningAreaTiers()));
    expect(draft.cleaningTier).toBe("101–150 m²");
    expect(draft.minisplits).toBe(1);
    expect(draft.bathrooms).toBe(2);
    expect(draft.bedrooms).toBe(3);
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
    expect(nav.className).toContain("customer-phonebar");
    expect(document.querySelector(".customer-topnav")).toBeNull();
    expect(icons[0]?.getAttribute("data-weight")).toBe("fill");
    expect(icons[0]?.getAttribute("width")).toBe("18");
    expect(icons[0]?.getAttribute("fill")).toBe(TAB_ACTIVE);
    expect(icons[1]?.getAttribute("data-weight")).toBe("regular");
    expect(icons[1]?.getAttribute("fill")).toBe(TAB_INACTIVE);
    tabs.forEach((link) => expect(link.className).toContain("flex-1"));
    expect(contrast(TAB_INACTIVE, TAB_BAR_BG)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByRole("heading", { level: 1, name: "Eduardo L. Vasquez" })).toBeTruthy();
    expect(screen.getByText("Community: Santa Sofía Residencial")).toBeTruthy();
    expect(screen.getByText("Address: Sierra Picachos 402")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Santa Sofía model" })).toBeTruthy();
    expect(screen.getByText("Santa Sofía Residencial (GP Vivienda)")).toBeTruthy();
    expect(screen.getByText("2 stories")).toBeTruthy();
    expect(screen.getByText("Lot: about 98 m²")).toBeTruthy();
    expect(screen.getByText("Built area: 100.49 m²")).toBeTruthy();
    expect(screen.getByText("Garage for 1–2 cars")).toBeTruthy();
    expect(screen.getByText("Combined living and dining room")).toBeTruthy();
    expect(screen.getByText("Built-in kitchen is optional")).toBeTruthy();
    expect(screen.getByText("Breakfast bar is optional")).toBeTruthy();
    expect(screen.getByText("1 full bathroom")).toBeTruthy();
    expect(screen.getByText("Laundry room")).toBeTruthy();
    expect(screen.getByText("Back patio")).toBeTruthy();
    expect(screen.getByText("Side passage")).toBeTruthy();
    expect(screen.getByText("3 bedrooms")).toBeTruthy();
    expect(screen.getByText("The main bedroom has space for a closet and a minisplit.")).toBeTruthy();
    expect(screen.getByText("1 shared full bathroom")).toBeTruthy();
    expect(screen.getByText("Exact plans vary by phase.")).toBeTruthy();

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

  it("moves the same tabs into the sticky header at tablet width", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("768"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })) as typeof window.matchMedia;
    try {
      render(<CustomerApp />);
      const nav = screen.getByRole("navigation", { name: "Main" });
      expect(nav.className).toContain("customer-topnav");
      expect(nav.getAttribute("data-placement")).toBe("top");
      expect(document.querySelector(".customer-phonebar")).toBeNull();
      expect(tabLabels()).toEqual(["My Home", "Request", "Warranty", "Help"]);
      expect(nav.querySelector(".customer-word")?.textContent).toBe("FIXX");
      const icons = nav.querySelectorAll("a svg");
      expect(icons[0]?.getAttribute("width")).toBe("18");
      expect(icons[0]?.getAttribute("fill")).toBe(TAB_ACTIVE);
      expect(icons[1]?.getAttribute("fill")).toBe(TAB_INACTIVE);
      fireEvent.click(within(nav).getByRole("link", { name: "Request" }));
      expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link")[1]?.getAttribute("aria-current")).toBe("page");
    } finally {
      if (original) window.matchMedia = original;
      else delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
  });

  it("shows Spanish labels for the same profile", async () => {
    await i18n.changeLanguage("es");
    render(<CustomerApp />);
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeTruthy();
    expect(tabLabels()).toEqual(["Mi hogar", "Solicitar", "Garantía", "Ayuda"]);
    expect(tabLinks()[0]?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1, name: "Eduardo L. Vasquez" })).toBeTruthy();
    expect(screen.getByText("Fraccionamiento: Santa Sofía Residencial")).toBeTruthy();
    expect(screen.getByText("Dirección: Sierra Picachos 402")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Modelo Santa Sofía" })).toBeTruthy();
    expect(screen.getByText("Santa Sofía Residencial (GP Vivienda)")).toBeTruthy();
    expect(screen.getByText("2 plantas")).toBeTruthy();
    expect(screen.getByText("Terreno: unos 98 m²")).toBeTruthy();
    expect(screen.getByText("Construcción: 100.49 m²")).toBeTruthy();
    expect(screen.getByText("Cochera para 1–2 autos")).toBeTruthy();
    expect(screen.getByText("3 recámaras")).toBeTruthy();
    expect(screen.getByText("La recámara principal tiene espacio para un clóset y un minisplit.")).toBeTruthy();
    expect(screen.getByText("Los planos exactos cambian según la etapa.")).toBeTruthy();
    expect(screen.queryByText("한국어 문구는 초안이에요.")).toBeNull();
  });

  it("reads My Home from the profile store, which registration can replace", () => {
    setHomeProfile({ homeownerName: "Ana Demo", community: "Valle Demo", address: "Calle Demo 1" });
    resetSession(false);
    session.signedIn = true;
    render(<CustomerApp />);
    expect(screen.getByRole("heading", { level: 1, name: "Ana Demo" })).toBeTruthy();
    expect(screen.getByText("Community: Valle Demo")).toBeTruthy();
    expect(screen.getByText("Address: Calle Demo 1")).toBeTruthy();
    expect(screen.queryByText(/Eduardo L\. Vasquez/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Santa Sofía model" })).toBeNull();
  });

  it("shows name and community as a read-only summary and keeps the street edit on this request", () => {
    render(<CustomerApp />);
    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Painting" }));

    const summary = screen.getByRole("region", { name: "From My Home" });
    expect(within(summary).getByText(seedProfile.homeownerName)).toBeTruthy();
    expect(within(summary).getByText(seedProfile.community)).toBeTruthy();
    expect(within(summary).queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText("Your name")).toBeNull();
    expect(screen.queryByLabelText("Community")).toBeNull();
    expect(screen.queryByText("These come from My Home. You can change them for this request.")).toBeNull();
    expect(screen.queryByText(/You can change them/)).toBeNull();
    const street = screen.getByLabelText("Street and number") as HTMLInputElement;
    expect(street.value).toBe(seedProfile.address);

    fireEvent.change(street, { target: { value: "Calle Demo 1" } });
    fireEvent.change(screen.getByLabelText(/What needs to be done/), { target: { value: "Paint the hall" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));
    expect(screen.getByText(seedProfile.homeownerName)).toBeTruthy();
    expect(screen.getByText(seedProfile.community)).toBeTruthy();
    expect(screen.getByText("Zone 1 (demo), Calle Demo 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "My Home" }));
    expect(screen.getByRole("heading", { level: 1, name: "Eduardo L. Vasquez" })).toBeTruthy();
    expect(screen.getByText("Community: Santa Sofía Residencial")).toBeTruthy();
    expect(screen.getByText("Address: Sierra Picachos 402")).toBeTruthy();
    expect(getHomeProfile()).toMatchObject(seedProfile);
    expect(getHomeProfile().model?.id).toBe("santa-sofia");

    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Painting" }));
    expect(within(screen.getByRole("region", { name: "From My Home" })).getByText(seedProfile.homeownerName)).toBeTruthy();
    expect((screen.getByLabelText("Street and number") as HTMLInputElement).value).toBe("Calle Demo 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit in My Home" }));
    expect(screen.getByRole("heading", { level: 1, name: "Eduardo L. Vasquez" })).toBeTruthy();
  });

  it("shows the Santa Sofía model in Korean as a draft", async () => {
    const ko = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/ko/cases.json"), "utf8")) as Record<string, { status: string; needsNativeReview?: boolean }>;
    for (const key of ["myhome.model.santaSofia", "myhome.plansVary", "myhome.mainBedroom", "myhome.translationDraft"]) {
      expect(ko[key]?.status).toBe("draft");
      expect(ko[key]?.needsNativeReview).toBe(true);
    }
    await i18n.changeLanguage("ko");
    render(<CustomerApp />);
    expect(screen.getByText("한국어 문구는 초안이에요.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "산타 소피아 모델" })).toBeTruthy();
    expect(screen.getByText("산타 소피아 레지던시알 (GP Vivienda)")).toBeTruthy();
    expect(screen.getByText("2층 주택")).toBeTruthy();
    expect(screen.getByText("대지면적: 약 98 m²")).toBeTruthy();
    expect(screen.getByText("연면적: 100.49 m²")).toBeTruthy();
    expect(screen.getByText("안방에는 옷장과 미니스플릿을 놓을 자리가 있어요.")).toBeTruthy();
    expect(screen.getByText("정확한 도면은 단계마다 다를 수 있어요.")).toBeTruthy();
  });

  it("shows quote counts from the model as a read-only summary and the quote still uses them", () => {
    render(<CustomerApp />);
    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Cleaning" }));

    const summary = screen.getByRole("region", { name: "From My Home" });
    expect(within(summary).getByText("101–150 m²")).toBeTruthy();
    expect(within(summary).getByText("Cleaning size")).toBeTruthy();
    expect(within(summary).getByText("Minisplits")).toBeTruthy();
    expect(within(summary).getByText("Bathrooms")).toBeTruthy();
    expect(within(summary).getByText("Bedrooms")).toBeTruthy();
    expect(within(summary).getByText("1")).toBeTruthy();
    expect(within(summary).getByText("2")).toBeTruthy();
    expect(within(summary).getByText("3")).toBeTruthy();
    expect(summary.querySelector("input, select")).toBeNull();
    expect(screen.queryByLabelText("Cleaning size")).toBeNull();
    expect(screen.queryByText("Filled in from My Home. You can change any of these for this request.")).toBeNull();
    expect(screen.queryByText(/You can change any of these/)).toBeNull();
    expect(session.draft.cleaningTier).toBe("101–150 m²");
    expect(session.draft.minisplits).toBe(1);
    expect(session.draft.bathrooms).toBe(2);
    expect(session.draft.bedrooms).toBe(3);

    fireEvent.change(screen.getByLabelText(/What needs to be done/), { target: { value: "Clean the house" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));
    expect(screen.getByText("Cleaning size: 101–150 m²")).toBeTruthy();
    expect(screen.getByText("1 minisplit, 2 bathrooms, 3 bedrooms")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "My Home" }));
    expect(screen.getByText("Built area: 100.49 m²")).toBeTruthy();
    expect(screen.getByText("1 full bathroom")).toBeTruthy();
    expect(screen.getByText("3 bedrooms")).toBeTruthy();
    expect(getHomeProfile().model?.minisplits).toBe(1);
    expect(getHomeProfile().model?.bedrooms).toBe(3);
  });
});
