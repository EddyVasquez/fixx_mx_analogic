import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chargeCardOnce, chargeWalletOnce, DEMO_CARDS, paymentChargeRuns, resetPaymentCharges } from "../src/mocks/payments/gateway";
import { actionTiming, createSingleFlight, paymentFailureKey, paymentIdempotencyKey, resetActionTiming, runTimed, setActionTimingForTests, sleep } from "../src/features/customer/actionTiming";
import { formatCustomerMXN } from "../src/features/customer/moneyFormat";
import { formatLock, nextResendAt, resendRemaining, RESEND_LOCK_SEC } from "../src/features/customer/signInActions";

describe("customer money format", () => {
  it("uses $450.00 MXN with en-US grouping in every language", () => {
    expect(formatCustomerMXN(450)).toBe("$450.00 MXN");
    expect(formatCustomerMXN(1234.5)).toBe("$1,234.50 MXN");
    expect(formatCustomerMXN(1000)).toBe("$1,000.00 MXN");
  });
});

describe("one charge per tap storm", () => {
  beforeEach(() => resetPaymentCharges());

  it("five overlapping charges with the same key run the card once", async () => {
    const key = paymentIdempotencyKey("job-customer", "deposit");
    const results = await Promise.all(Array.from({ length: 5 }, () => chargeCardOnce(DEMO_CARDS.approved, 450, key, () => sleep(30))));
    expect(paymentChargeRuns()).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(key).toBe("pay:job-customer:deposit");
    expect(key.includes(DEMO_CARDS.approved)).toBe(false);
  });

  it("a retry after success does not charge again", async () => {
    const key = paymentIdempotencyKey("job-customer", "deposit");
    await chargeWalletOnce(450, key, async () => undefined);
    await chargeWalletOnce(450, key, async () => undefined);
    expect(paymentChargeRuns()).toBe(1);
  });

  it("a declined card can be tried again, and an unclear result cannot", async () => {
    const declined = paymentIdempotencyKey("job-customer", "deposit");
    const first = await chargeCardOnce(DEMO_CARDS.declined, 450, declined, async () => undefined);
    const second = await chargeCardOnce(DEMO_CARDS.approved, 450, declined, async () => undefined);
    expect(first).toEqual({ ok: false, reason: "declined" });
    expect(second.ok).toBe(true);
    expect(paymentChargeRuns()).toBe(2);

    resetPaymentCharges();
    const unknown = paymentIdempotencyKey("job-customer", "balance");
    const unclear = await chargeCardOnce(DEMO_CARDS.unknown, 450, unknown, async () => undefined);
    await chargeCardOnce(DEMO_CARDS.approved, 450, unknown, async () => undefined);
    expect(unclear).toEqual({ ok: false, reason: "unknown" });
    expect(paymentChargeRuns()).toBe(1);
  });

  it("a network failure that confirms nothing was charged can be retried", async () => {
    const key = paymentIdempotencyKey("job-customer", "full");
    const failed = await chargeCardOnce(DEMO_CARDS.network, 450, key, async () => undefined);
    await chargeCardOnce(DEMO_CARDS.approved, 450, key, async () => undefined);
    expect(failed).toEqual({ ok: false, reason: "network" });
    expect(paymentChargeRuns()).toBe(2);
  });
});

describe("in-flight guard", () => {
  it("five calls started together run the task once", async () => {
    const run = createSingleFlight();
    let n = 0;
    const results = await Promise.all(Array.from({ length: 5 }, () => run(async () => {
      n += 1;
      await sleep(20);
      return "ok" as const;
    })));
    expect(n).toBe(1);
    expect(results.filter((r) => r === "ok")).toEqual(["ok"]);
    expect(results.filter((r) => r === "blocked")).toHaveLength(4);
  });
});

describe("slow and timeout timing", () => {
  afterEach(() => { vi.useRealTimers(); resetActionTiming(); });

  it("warns at 15 seconds and stops at 30", async () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const pending = runTimed(() => new Promise(() => undefined), onSlow);
    await vi.advanceTimersByTimeAsync(actionTiming.slowMs);
    expect(onSlow).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(actionTiming.timeoutMs - actionTiming.slowMs);
    await expect(pending).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("a timeout uses the unclear payment message, and a confirmed network error does not", () => {
    expect(paymentFailureKey("timeout")).toBe("pay.unknown");
    expect(paymentFailureKey("unknown")).toBe("pay.unknown");
    expect(paymentFailureKey("network")).toBe("pay.network");
    expect(paymentFailureKey("declined")).toBe("pay.declined");
    expect(paymentFailureKey("invalid")).toBe("pay.invalid");
  });
});

describe("sign-in resend lock", () => {
  it("stays locked for 60 seconds after a send", () => {
    expect(RESEND_LOCK_SEC).toBe(60);
    const now = 1_000_000;
    const until = nextResendAt(now);
    expect(resendRemaining(until, now)).toBe(60);
    expect(resendRemaining(until, now + 59_000)).toBe(1);
    expect(resendRemaining(until, now + 60_000)).toBe(0);
    expect(formatLock(60)).toBe("1:00");
    expect(formatLock(45)).toBe("0:45");
  });
});

describe("action timing can be shortened in tests", () => {
  afterEach(() => resetActionTiming());
  it("restores the demo waits", () => {
    setActionTimingForTests({ latencyMs: 0, successPauseMs: 0 });
    expect(actionTiming.latencyMs).toBe(0);
    resetActionTiming();
    expect(actionTiming.latencyMs).toBe(2000);
  });
});
