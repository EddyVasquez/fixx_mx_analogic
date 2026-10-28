/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "../src/i18n";
import { EstimateView } from "../src/features/customer/Estimate";
import { JobChips, type JobOption } from "../src/features/customer/JobChips";
import { jobsForCategory } from "../src/features/customer/catalogJobs";
import { buildJobSentence } from "../src/features/customer/jobSentence";
import { RequestBuilder } from "../src/features/customer/RequestBuilder";
import { emptyDraft, type Draft } from "../src/features/customer/session";

function Form({ categoryId = "plumbing" }: { categoryId?: string }) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft({ categoryId }));
  return <RequestBuilder draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} onReview={() => undefined} />;
}

function jobGroup() {
  return screen.getByRole("group", { name: "Jobs for this trade" });
}

function chips() {
  return within(jobGroup()).getAllByRole("button");
}

function description() {
  return screen.getByLabelText(/What needs to be done/) as HTMLTextAreaElement;
}

describe("job chip selection", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    await i18n.changeLanguage("en");
  });

  it("toggles with a click, with no checkbox, and writes the description", () => {
    render(<Form />);
    const group = jobGroup();
    expect(group.querySelector('input[type="checkbox"]')).toBeNull();
    const [first, second] = chips();
    expect(first?.getAttribute("aria-pressed")).toBe("false");
    expect(second?.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(first!);
    expect(first?.getAttribute("aria-pressed")).toBe("true");
    expect(first?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(description().value).toBe("Toilet repair.");
    expect(screen.getByText("Toilet repair selected, 1 jobs selected")).toBeTruthy();

    fireEvent.click(second!);
    expect(second?.getAttribute("aria-pressed")).toBe("true");
    expect(description().value).toBe("Toilet repair and single-lever faucet install (faucet excluded).");
    expect(screen.getByText(/2 jobs selected/)).toBeTruthy();

    fireEvent.click(first!);
    expect(first?.getAttribute("aria-pressed")).toBe("false");
    expect(description().value).toBe("Single-lever faucet install (faucet excluded).");
  });

  it("keeps selection order and toggles from the keyboard", () => {
    render(<Form />);
    const [first, , third] = chips();
    third?.focus();
    fireEvent.keyDown(third!, { key: "Enter" });
    expect(third?.getAttribute("aria-pressed")).toBe("true");
    expect(description().value).toBe("Two-handle faucet (supply lines only).");

    fireEvent.keyDown(first!, { key: " " });
    expect(first?.getAttribute("aria-pressed")).toBe("true");
    expect(description().value).toBe("Two-handle faucet (supply lines only) and toilet repair.");

    fireEvent.keyDown(third!, { key: " " });
    expect(third?.getAttribute("aria-pressed")).toBe("false");
    expect(description().value).toBe("Toilet repair.");
  });

  it("does not toggle when a drag starts on a chip", () => {
    render(<Form />);
    const first = chips()[0]!;
    // jsdom's pointer events omit clientX, so the drag distance is attached before dispatch.
    const point = (type: "pointerDown" | "pointerMove" | "pointerUp", x: number, y: number) => {
      const event = createEvent[type](first, { clientX: x, clientY: y });
      Object.defineProperty(event, "clientX", { configurable: true, value: x });
      Object.defineProperty(event, "clientY", { configurable: true, value: y });
      fireEvent(first, event);
    };
    point("pointerDown", 0, 0);
    point("pointerMove", 24, 0);
    point("pointerUp", 24, 0);
    fireEvent.click(first);
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(description().value).toBe("");

    fireEvent.click(first);
    expect(first.getAttribute("aria-pressed")).toBe("true");
  });

  it("stops rewriting after the customer types, then updates and can undo", () => {
    vi.useFakeTimers();
    render(<Form />);
    const [first, second] = chips();
    fireEvent.click(first!);
    fireEvent.change(description(), { target: { value: "My own note" } });
    fireEvent.click(second!);
    expect(description().value).toBe("My own note");
    expect(second?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Update from selected jobs" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Update from selected jobs" }));
    expect(description().value).toBe("Toilet repair and single-lever faucet install (faucet excluded).");
    expect(screen.queryByRole("button", { name: "Update from selected jobs" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(description().value).toBe("My own note");
    expect(screen.getByRole("button", { name: "Update from selected jobs" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Update from selected jobs" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("returns to auto mode when the field is cleared", () => {
    render(<Form />);
    const [first, second] = chips();
    fireEvent.click(first!);
    fireEvent.change(description(), { target: { value: "My own note" } });
    fireEvent.change(description(), { target: { value: "   " } });
    expect(description().value).toBe("");
    expect(screen.queryByRole("button", { name: "Update from selected jobs" })).toBeNull();
    fireEvent.click(second!);
    expect(description().value).toBe("Toilet repair and single-lever faucet install (faucet excluded).");
  });

  it("fills Spanish and Korean from the chips the customer picks", async () => {
    const { unmount } = render(<Form />);
    unmount();
    await i18n.changeLanguage("es");
    render(<Form />);
    const esJobs = jobsForCategory("plumbing", "es");
    const esChips = within(screen.getByRole("group", { name: "Trabajos de este oficio" })).getAllByRole("button");
    fireEvent.click(esChips[0]!);
    fireEvent.click(esChips[2]!);
    expect((screen.getByLabelText(/¿Qué hay que hacer/) as HTMLTextAreaElement).value).toBe(
      buildJobSentence([esJobs[0]!, esJobs[2]!].map((job) => ({ label: job.title, keepCase: job.keepCase })), "es")
    );
    cleanup();

    await i18n.changeLanguage("ko");
    render(<Form />);
    const koJobs = jobsForCategory("plumbing", "ko");
    const koChips = within(screen.getByRole("group", { name: "이 분야의 작업" })).getAllByRole("button");
    fireEvent.click(koChips[0]!);
    fireEvent.click(koChips[1]!);
    fireEvent.click(koChips[2]!);
    expect((screen.getByLabelText(/어떤 작업이 필요한가요/) as HTMLTextAreaElement).value).toBe(
      buildJobSentence(koJobs.slice(0, 3).map((job) => ({ label: job.title, keepCase: job.keepCase })), "ko")
    );
  });

  it("shows eight chips until Show all, and a disabled chip stays focusable", () => {
    const jobs: JobOption[] = Array.from({ length: 9 }, (_, index) => ({
      id: `j${index}`,
      label: index === 8 ? "Instalar el último" : `Fix job ${index + 1}`
    }));
    jobs.push({ id: "gas", label: "Gas connector", disabledReason: "Pending review" });
    const onChange = vi.fn();
    render(<JobChips headingId="jobs-h" jobs={jobs} selectedIds={[]} onChange={onChange} />);
    const group = screen.getByRole("group");
    expect(within(group).getAllByRole("button")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: "Instalar el último" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all (10)" }));
    expect(screen.getByRole("button", { name: "Instalar el último" })).toBeTruthy();

    const disabled = screen.getByRole("button", { name: "Gas connector" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    expect(disabled.hasAttribute("disabled")).toBe(false);
    expect(disabled.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Pending review")).toBeTruthy();
    fireEvent.click(disabled);
    fireEvent.keyDown(disabled, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the TV acronym flagged so a later chip does not lowercase it", () => {
    const jobs = jobsForCategory("handyman", "en");
    const tv = jobs.find((job) => job.title.startsWith("TV"));
    expect(tv?.keepCase).toBe(true);
    expect(tv?.pendingReview).toBe(false);
    render(<Form categoryId="handyman" />);
    const group = screen.getByRole("group", { name: "Jobs for this trade" });
    const buttons = within(group).getAllByRole("button");
    const other = buttons.find((button) => !button.textContent?.startsWith("TV"));
    const acronym = buttons.find((button) => button.textContent?.startsWith("TV"));
    fireEvent.click(other!);
    fireEvent.click(acronym!);
    expect(description().value.endsWith("and TV wall mount, 1 TV (TV excluded; budget/standard tilt ≤70 in, premium articulated).")).toBe(true);
    expect(description().value).not.toContain("and tV");
  });

  it("shows regulated jobs as pending review, with centavos and no margin or commission", () => {
    render(<EstimateView draft={emptyDraft({ categoryId: "pest_control" })} onNext={() => undefined} />);
    expect(screen.getByText("Pending review")).toBeTruthy();
    expect(screen.getByText(/\$[\d,]+\.\d{2} MXN to \$[\d,]+\.\d{2} MXN/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/commission|comisi[oó]n|수수료|\bmargin\b/i);

    cleanup();
    render(<Form categoryId="pest_control" />);
    const pest = within(screen.getByRole("group", { name: "Jobs for this trade" })).getAllByRole("button");
    expect(pest.length).toBeGreaterThan(0);
    pest.forEach((chip) => {
      expect(chip.getAttribute("aria-disabled")).toBeNull();
      expect(chip.getAttribute("aria-describedby")).toBeTruthy();
    });
    expect(screen.getAllByText("Pending review")).toHaveLength(pest.length);
    expect(document.body.textContent).not.toMatch(/commission|comisi[oó]n|수수료|\bmargin\b/i);
    expect(screen.getByRole("group", { name: "Jobs for this trade" }).querySelector('input[type="checkbox"]')).toBeNull();
  });
});
