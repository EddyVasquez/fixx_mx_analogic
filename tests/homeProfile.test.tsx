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
import { matchingAreaTier } from "../src/core/pricing/areaTier";
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
    expect(icons[0]?.getAttribute("data-weight")).toBe("fill");
    expect(icons[0]?.getAttribute("width")).toBe("24");
    expect(icons[0]?.getAttribute("fill")).toBe(colors.brand);
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
    expect(screen.getByRole("heading", { level: 1, name: "Eduardo L. Vasquez" })).toBeTruthy();
    expect(screen.getByText("Community: Santa Sofía Residencial")).toBeTruthy();
    expect(screen.getByText("Address: Sierra Picachos 402")).toBeTruthy();
    expect(getHomeProfile()).toMatchObject(seedProfile);
    expect(getHomeProfile().model?.id).toBe("santa-sofia");

    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Painting" }));
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Ana Demo");
    expect((screen.getByLabelText("Community") as HTMLInputElement).value).toBe("Valle Demo");
    expect((screen.getByLabelText("Street and number") as HTMLInputElement).value).toBe("Calle Demo 1");
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

  it("prefills quote counts from the model and keeps edits on this request", () => {
    render(<CustomerApp />);
    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Cleaning" }));

    const size = screen.getByLabelText("Cleaning size") as HTMLSelectElement;
    const minisplits = screen.getByLabelText(/Minisplits/) as HTMLInputElement;
    const bathrooms = screen.getByLabelText("Bathrooms") as HTMLInputElement;
    const bedrooms = screen.getByLabelText("Bedrooms") as HTMLInputElement;
    expect(size.value).toBe("101–150 m²");
    expect(minisplits.value).toBe("1");
    expect(bathrooms.value).toBe("2");
    expect(bedrooms.value).toBe("3");
    expect(screen.getByText("Filled in from My Home. You can change any of these for this request.")).toBeTruthy();
    expect(screen.getByText("The main bedroom has space for one.")).toBeTruthy();

    fireEvent.change(size, { target: { value: "≤60 m²" } });
    fireEvent.change(minisplits, { target: { value: "2" } });
    fireEvent.change(bathrooms, { target: { value: "4" } });
    fireEvent.change(bedrooms, { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/What needs to be done/), { target: { value: "Clean the house" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));
    expect(screen.getByText("Cleaning size: ≤60 m²")).toBeTruthy();
    expect(screen.getByText("2 minisplits, 4 bathrooms, 5 bedrooms")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "My Home" }));
    expect(screen.getByText("Built area: 100.49 m²")).toBeTruthy();
    expect(screen.getByText("1 full bathroom")).toBeTruthy();
    expect(screen.getByText("3 bedrooms")).toBeTruthy();
    expect(getHomeProfile().model?.minisplits).toBe(1);
    expect(getHomeProfile().model?.bedrooms).toBe(3);

    fireEvent.click(screen.getByRole("link", { name: "Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Cleaning" }));
    expect((screen.getByLabelText("Cleaning size") as HTMLSelectElement).value).toBe("≤60 m²");
    expect((screen.getByLabelText(/Minisplits/) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Bathrooms") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Bedrooms") as HTMLInputElement).value).toBe("5");
  });
});
