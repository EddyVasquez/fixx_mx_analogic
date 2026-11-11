/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18n from "../src/i18n";
import { EstimateView } from "../src/features/customer/Estimate";
import { Home } from "../src/features/customer/Home";
import { RequestBuilder, RequestReview } from "../src/features/customer/RequestBuilder";
import { requestSubProgress } from "../src/features/customer/requestProgress";
import { emptyDraft } from "../src/features/customer/session";

const noop = () => undefined;

describe("request journey meter", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("starts the choose-a-trade screen at step 1 with an empty line", () => {
    render(<Home name="Ana" email="" onPick={noop} onJob={noop} onDescribe={noop} onUrgent={noop} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("aria-valuetext")).toBe("Request sent, 0% of this step");
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("requestSubmitted");
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();
    expect(screen.queryByText("Pending review")).toBeNull();
  });

  it("asks for a trade before the request can be reviewed", () => {
    const draft = emptyDraft({ categoryId: "", description: "Paint the hall" });
    render(<RequestBuilder draft={draft} onChange={noop} onReview={noop} />);
    const review = screen.getByRole("button", { name: "Review request" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    expect(screen.getByText("Choose a service so we know which trade to send.")).toBeTruthy();
    expect(document.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("fills half the line on the request form when the trade and the details are done", () => {
    const draft = emptyDraft({
      categoryId: "painting",
      description: "Paint the hall",
      photos: 0,
      emergency: false,
      street: "Sierra Picachos 402"
    });
    expect(requestSubProgress(draft)).toBe(0.5);
    render(<RequestBuilder draft={draft} onChange={noop} onReview={noop} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(bar.getAttribute("aria-valuetext")).toBe("Request sent, 50% of this step");
    expect(document.querySelector<HTMLElement>(".job-meter-rail")?.style.getPropertyValue("--progress")).toBe("0.5");
    expect(document.querySelector(".job-meter-line-partial")).toBeTruthy();
  });

  it("counts photos and address together, and the review screen as the fourth sub-step", () => {
    const base = { categoryId: "electrical", description: "Outlet", photos: 0, emergency: false, street: "Calle 1" };
    expect(requestSubProgress(base)).toBe(0.5);
    expect(requestSubProgress({ ...base, photos: 1 })).toBe(0.75);
    expect(requestSubProgress({ ...base, emergency: true })).toBe(0.75);
    expect(requestSubProgress({ ...base, photos: 1, street: "  " })).toBe(0.5);
    expect(requestSubProgress({ ...base, photos: 1 }, true)).toBe(1);

    const draft = emptyDraft({ ...base, photos: 2 });
    render(<RequestReview draft={draft} onEdit={noop} onSubmit={noop} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("requestSubmitted");
  });

  it("shows the instant quote at step 2 with no partial fill", () => {
    render(<EstimateView draft={emptyDraft({ categoryId: "painting" })} onNext={noop} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("aria-valuetext")).toBe("Price range ready, 0% of this step");
    expect(document.querySelector(".job-meter-node-current")?.getAttribute("data-status")).toBe("estimated");
    expect(document.querySelector(".job-meter-line-done")).toBeTruthy();
    expect(document.querySelector(".job-meter-line-partial")).toBeNull();
    expect(screen.getByText("Step 2 of 12")).toBeTruthy();
    expect(screen.queryByText("Pending review")).toBeNull();
  });
});
