export type ClabeResult = { ok: true } | { ok: false; reason: "invalid" | "rejected" | "network" };
export type AutoResult = { ok: true } | { ok: false; reason: "failed" };

/** Demo CLABEs: all 1s are rejected by the bank, all 2s drop the connection. */
export const CLABE_REJECTED = "111111111111111111";
export const CLABE_NETWORK = "222222222222222222";

export function clabeDigits(clabe: string): string {
  return clabe.replace(/\D/g, "");
}

export function settleClabe(clabe: string, save: (digits: string) => boolean): ClabeResult {
  const digits = clabeDigits(clabe);
  if (digits.length !== 18) return { ok: false, reason: "invalid" };
  if (digits === CLABE_REJECTED) return { ok: false, reason: "rejected" };
  if (digits === CLABE_NETWORK) return { ok: false, reason: "network" };
  return save(digits) ? { ok: true } : { ok: false, reason: "invalid" };
}
