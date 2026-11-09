const HELD_LINE_FLAGS = new Set(["flagged-human review", "reference only-cofepris", "structural"]);

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Labor_Flag "pending quotes", or a Review_Status that starts with "PENDING QUOTES".
 * Matching ignores case. A longer status such as "PENDING QUOTES – herrero" still counts.
 */
export function isPendingQuotes(flag?: string | null, reviewStatus?: string | null): boolean {
  const flagValue = normalized(flag);
  const status = normalized(reviewStatus);
  const flagHit = flagValue === "pending quotes" || flagValue.startsWith("pending quotes ") || flagValue.startsWith("pending quotes-") || flagValue.startsWith("pending quotes–");
  return flagHit || status.startsWith("pending quotes");
}

/**
 * Line flags kept out of a bookable total: FLAGGED (human review), REFERENCE ONLY-COFEPRIS,
 * structural, and pending quotes.
 */
export function isHeldLineFlag(flag?: string | null): boolean {
  return HELD_LINE_FLAGS.has(normalized(flag)) || isPendingQuotes(flag);
}
