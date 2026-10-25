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

export const DEMO_CARDS = { approved: "4242424242424242", declined: "4000000000000002" } as const;

export type ChargeResult = { ok: true } | { ok: false; reason: "invalid" | "declined" };
export function chargeCard(cardNumber: string, amount: number): ChargeResult {
  const n = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{16}$/.test(n) || !(amount > 0)) return { ok: false, reason: "invalid" };
  return n === DEMO_CARDS.declined ? { ok: false, reason: "declined" } : { ok: true };
}
/** Apple Pay / Google Pay always succeed in the demo. */
export const chargeWallet = (amount: number): ChargeResult => (amount > 0 ? { ok: true } : { ok: false, reason: "invalid" });
