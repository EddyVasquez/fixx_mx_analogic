/** Mock payment services. Every value is fake and starts with DEMO so it can never be mistaken for a real one. */
const hash = (s: string): number => { let h = 5381; for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h; };
const digits = (seed: string, len: number): string => {
  let out = "", n = hash(seed);
  while (out.length < len) { out += String(n).padStart(10, "0"); n = hash(String(n) + seed); }
  return out.slice(0, len);
};

/** OXXO-style cash reference. */
export const cashReference = (paymentId: string): string => `DEMO-${digits(paymentId, 14)}`;

/** SPEI instructions. The CLABE is a made-up number (000 prefix), not a real account. */
export function speiDetails(paymentId: string): { clabe: string; concept: string; beneficiary: string } {
  return { clabe: `000${digits("clabe" + paymentId, 15)}`, concept: `DEMO${digits(paymentId, 6)}`, beneficiary: "FIXX Demo" };
}

export const DEMO_CARDS = {
  approved: "4242424242424242",
  declined: "4000000000000002",
  /** The server says the connection failed and nothing was charged. */
  network: "4000000000009995",
  /** The server does not say whether the charge went through. */
  unknown: "4000000000009987"
} as const;

export type ChargeResult = { ok: true } | { ok: false; reason: "invalid" | "declined" };
export type ChargeOutcome = { ok: true } | { ok: false; reason: "invalid" | "declined" | "network" | "unknown" };

export function chargeCard(cardNumber: string, amount: number): ChargeResult {
  const n = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{16}$/.test(n) || !(amount > 0)) return { ok: false, reason: "invalid" };
  return n === DEMO_CARDS.declined ? { ok: false, reason: "declined" } : { ok: true };
}
/** Apple Pay / Google Pay always succeed in the demo. */
export const chargeWallet = (amount: number): ChargeResult => (amount > 0 ? { ok: true } : { ok: false, reason: "invalid" });

/**
 * One real charge per idempotency key while a request is in flight or might have succeeded.
 * A declined card, an invalid number, or a network error that confirms nothing was charged
 * can be tried again with the same key. The card number is never stored or logged.
 */
type LedgerEntry = { promise: Promise<ChargeOutcome>; settled?: ChargeOutcome };
const ledger = new Map<string, LedgerEntry>();
let chargeRuns = 0;

export function paymentChargeRuns(): number { return chargeRuns; }
export function resetPaymentCharges(): void { ledger.clear(); chargeRuns = 0; }

export function chargeIdempotent(key: string, run: () => Promise<ChargeOutcome>): Promise<ChargeOutcome> {
  const existing = ledger.get(key);
  if (existing && (existing.settled === undefined || existing.settled.ok || existing.settled.reason === "unknown")) {
    return existing.promise;
  }
  const entry: LedgerEntry = { promise: Promise.resolve({ ok: false, reason: "unknown" }) };
  ledger.set(key, entry);
  chargeRuns += 1;
  const promise = run().then(
    (result) => {
      if (result.ok || result.reason === "unknown") entry.settled = result;
      else ledger.delete(key);
      return result;
    },
    () => {
      const result: ChargeOutcome = { ok: false, reason: "unknown" };
      entry.settled = result;
      return result;
    }
  );
  entry.promise = promise;
  return promise;
}

function demoCardOutcome(cardNumber: string, amount: number): ChargeOutcome {
  const n = cardNumber.replace(/[\s-]/g, "");
  if (n === DEMO_CARDS.network) return { ok: false, reason: "network" };
  if (n === DEMO_CARDS.unknown) return { ok: false, reason: "unknown" };
  const sync = chargeCard(n, amount);
  return sync.ok ? { ok: true } : sync;
}

export function chargeCardOnce(cardNumber: string, amount: number, idempotencyKey: string, wait: () => Promise<void>): Promise<ChargeOutcome> {
  return chargeIdempotent(idempotencyKey, async () => {
    await wait();
    return demoCardOutcome(cardNumber, amount);
  });
}

export function chargeWalletOnce(amount: number, idempotencyKey: string, wait: () => Promise<void>): Promise<ChargeOutcome> {
  return chargeIdempotent(idempotencyKey, async () => {
    await wait();
    const sync = chargeWallet(amount);
    return sync.ok ? { ok: true } : { ok: false, reason: "invalid" };
  });
}
