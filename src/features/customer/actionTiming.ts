/** How long a payment, refund, or sign-in request is allowed to feel busy. */
export const actionTiming = {
  /** Simulated wait so the processing state is visible in the demo. */
  latencyMs: 2000,
  /** Show a "still working" hint after this long. */
  slowMs: 15_000,
  /** Stop waiting and show the network failure after this long. */
  timeoutMs: 30_000,
  /** How long the success confirmation stays before the next screen. */
  successPauseMs: 900
};

const defaults = { ...actionTiming };

export function setActionTimingForTests(next: Partial<typeof actionTiming>): void {
  Object.assign(actionTiming, next);
}

export function resetActionTiming(): void {
  Object.assign(actionTiming, defaults);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export type Timed<T> = { ok: true; value: T } | { ok: false; reason: "timeout" };

/**
 * Runs work. Calls onSlow after 15 seconds and resolves as a timeout after 30 seconds.
 * The work is not cancelled: a payment can still settle in the idempotency ledger.
 */
export function runTimed<T>(work: () => Promise<T>, onSlow: () => void): Promise<Timed<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Timed<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      resolve(value);
    };
    const slowTimer = setTimeout(onSlow, actionTiming.slowMs);
    const timeoutTimer = setTimeout(() => finish({ ok: false, reason: "timeout" }), actionTiming.timeoutMs);
    work().then(
      (value) => finish({ ok: true, value }),
      () => finish({ ok: false, reason: "timeout" })
    );
  });
}

/**
 * Lets the first call run and drops later calls until that call settles.
 * A fast second tap returns "blocked" instead of starting another request.
 */
export function createSingleFlight() {
  let flight = false;
  return async function run<T>(task: () => Promise<T>): Promise<T | "blocked"> {
    if (flight) return "blocked";
    flight = true;
    try {
      return await task();
    } finally {
      flight = false;
    }
  };
}

/** Card and wallet charges use one key per installment, including retries. */
export function paymentIdempotencyKey(jobId: string, kind: string): string {
  return `pay:${jobId}:${kind}`;
}

export type PayFailure = "invalid" | "declined" | "network" | "unknown" | "timeout";

/** A timeout did not get a confirmation, so it uses the "not sure" message rather than "nothing was charged". */
export function paymentFailureKey(reason: PayFailure): "pay.invalid" | "pay.declined" | "pay.network" | "pay.unknown" {
  if (reason === "invalid") return "pay.invalid";
  if (reason === "declined") return "pay.declined";
  if (reason === "network") return "pay.network";
  return "pay.unknown";
}
