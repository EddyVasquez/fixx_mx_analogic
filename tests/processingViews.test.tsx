/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Clock } from "../src/core/clock/clock";
import { newJobCtx } from "../src/core/machines";
import i18n from "../src/i18n";
import { DemoRuntime } from "../src/mocks/runtime/runtime";
import { DEMO_CARDS, paymentChargeRuns, resetPaymentCharges } from "../src/mocks/payments/gateway";
import { failNextReferences } from "../src/mocks/runtime/paymentActors";
import { resetActionTiming, setActionTimingForTests } from "../src/features/customer/actionTiming";
import { PaymentView } from "../src/features/customer/PaymentView";
import { RefundView } from "../src/features/customer/RefundView";
import { SignIn } from "../src/features/customer/SignIn";
import type { RefundRecord } from "../src/mocks/runtime/runtime";

const refund = (over: Partial<RefundRecord> = {}): RefundRecord => ({
  id: "r1", actorId: "job-customer", amount: 450, destination: "original",
  at: "2026-10-26T16:00:00.000Z", expectedBy: "2026-10-29T16:00:00.000Z", ...over
});

function payView(onPaid = vi.fn()) {
  const rt = new DemoRuntime(new Clock(0, () => Date.parse("2026-10-26T16:00:00.000Z")));
  const ctx = newJobCtx({
    method: "card", total: 2250, initialDue: 450, paid: 0, payoutRatio: 0.8,
    jobStart: new Date("2026-10-28T16:00:00.000Z"),
    scheduleBasis: new Date("2026-10-26T16:00:00.000Z")
  });
  const view = render(<PaymentView ctx={ctx} method="card" rt={rt} onPaid={onPaid} />);
  return { ...view, onPaid, rt, ctx };
}

describe("payment, refund, and sign-in states", () => {
  beforeEach(async () => {
    resetPaymentCharges();
    failNextReferences(0);
    setActionTimingForTests({ latencyMs: 0, successPauseMs: 0, slowMs: 60_000, timeoutMs: 60_000 });
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    cleanup();
    resetActionTiming();
    await i18n.changeLanguage("en");
  });

  it("tapping Pay five times charges exactly once and then confirms", async () => {
    const { onPaid } = payView();
    fireEvent.change(screen.getByLabelText("Card number"), { target: { value: DEMO_CARDS.approved } });
    const button = screen.getByRole("button", { name: "Pay deposit" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByRole("status").textContent).toContain("Processing your payment");
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
    expect(onPaid).toHaveBeenCalledWith(450);
    expect(paymentChargeRuns()).toBe(1);
    expect(screen.getByText("Payment received: $450.00 MXN")).toBeTruthy();
  });

  it("keeps a declined card on screen, focuses it, and lets the person try again", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    payView();
    const input = screen.getByLabelText("Card number") as HTMLInputElement;
    fireEvent.change(input, { target: { value: DEMO_CARDS.declined } });
    fireEvent.click(screen.getByRole("button", { name: "Pay deposit" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("did not go through");
    expect(input.value).toBe(DEMO_CARDS.declined);
    expect(input).toHaveProperty("readOnly", false);
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("pay-error");
    expect(screen.getByRole("button", { name: "Try again" }).hasAttribute("disabled")).toBe(false);
    expect(setItem.mock.calls.some((call) => String(call).includes(DEMO_CARDS.declined))).toBe(false);
    expect(log.mock.calls.some((call) => String(call).includes(DEMO_CARDS.declined))).toBe(false);
    log.mockRestore();
    setItem.mockRestore();
  });

  it("shows the unclear message when the server does not confirm the charge", async () => {
    payView();
    fireEvent.change(screen.getByLabelText("Card number"), { target: { value: DEMO_CARDS.unknown } });
    fireEvent.click(screen.getByRole("button", { name: "Pay deposit" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We'll confirm in a few minutes");
    expect(screen.queryByText(/nothing was charged/i)).toBeNull();
  });

  it("shows the same $450.00 MXN amount in Spanish and Korean, with no commission", async () => {
    const { rerender, rt, ctx } = payView();
    expect(screen.getByText("Deposit due now: $450.00 MXN")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/commission|comisi[oó]n|수수료|payout/i);
    await i18n.changeLanguage("es");
    rerender(<PaymentView ctx={ctx} method="card" rt={rt} onPaid={() => undefined} />);
    expect(screen.getByText("Depósito a pagar ahora: $450.00 MXN")).toBeTruthy();
    await i18n.changeLanguage("ko");
    rerender(<PaymentView ctx={ctx} method="card" rt={rt} onPaid={() => undefined} />);
    expect(screen.getByText("지금 결제할 예약금: $450.00 MXN")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/0\.8|80%/);
  });

  it("calls onAuto once across re-renders, and again only when the refund id or issued flag changes", async () => {
    const onAuto = vi.fn(async () => ({ ok: true as const }));
    const props = { onAuto, onClabe: async () => ({ ok: true as const }), onStartOver: () => undefined };
    const { rerender } = render(<RefundView refund={refund()} issued={false} {...props} />);
    await waitFor(() => expect(onAuto).toHaveBeenCalledTimes(1));
    rerender(<RefundView refund={refund()} issued={false} {...props} />);
    rerender(<RefundView refund={refund()} issued={false} onAuto={onAuto} onClabe={props.onClabe} onStartOver={props.onStartOver} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onAuto).toHaveBeenCalledTimes(1);
    rerender(<RefundView refund={refund()} issued {...props} />);
    rerender(<RefundView refund={refund({ id: "r2" })} issued={false} {...props} />);
    await waitFor(() => expect(onAuto).toHaveBeenCalledTimes(2));
  });

  it("rejects a short CLABE without processing and keeps what was typed", async () => {
    const onClabe = vi.fn(async () => ({ ok: true as const }));
    render(<RefundView refund={refund({ destination: "clabe" })} issued={false} onAuto={async () => ({ ok: true })} onClabe={onClabe} onStartOver={() => undefined} />);
    const input = screen.getByRole("textbox", { name: /CLABE/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234 5678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send CLABE" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("18 digits");
    expect(onClabe).not.toHaveBeenCalled();
    expect(input.value).toBe("1234 5678");
    expect(screen.getByText("18 digits")).toBeTruthy();
    expect(screen.getByText("Refund: $450.00 MXN")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("locks Send a new code for 60 seconds and keeps the phone number", async () => {
    render(<SignIn onDone={() => undefined} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Phone number/ }), { target: { value: "5551234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(screen.getByRole("status").textContent).toContain("Sending your code by SMS");
    await screen.findByLabelText("Code");
    const resend = screen.getByRole("button", { name: "Send a new code" });
    expect(resend.hasAttribute("disabled")).toBe(true);
    expect(resend.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("You can ask for a new code in 1:00")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This code expired");
  });
});
