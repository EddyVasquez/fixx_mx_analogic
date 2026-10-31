// Single source of truth for design tokens. Tailwind reads this file.
// Greyscale on purpose (current direction); a real palette can replace these values later without touching components.
// Contrast of every text/background pair is verified in tests/contrast.test.ts.
export const colors = {
  brand: "#2E2E2E",     // primary fill (buttons). Text on it is paper.
  brandDeep: "#2E2E2E", // focus ring
  ink: "#2E2E2E",       // body text
  inkSoft: "#484848",   // secondary text
  paper: "#FFFFFF",
  mist: "#ECECEC",      // page background
  panel: "#D4D4D4",     // work-order panel
  line: "#C8C8C8",      // borders (non-text)
  label: "#1A1A1A",     // black field labels (white text)
  hlOk: "#A0A0A0",      // highlight: needs your OK
  danger: "#1A1A1A",    // errors are marked with weight and borders, not hue
  warnBg: "#E6E6E6",    // demo-value marker
  warnInk: "#2E2E2E",
  warnAmberBg: "#FFE8A3",  // pending-review banner
  warnAmberInk: "#3F2A00",
  /** Hub accent. Only the main hero card and the stat tiles, with ink on top. Never behind the blueprint, and never text or a thin icon. */
  accent: "#DFFF32"
} as const;

export const textPairs: ReadonlyArray<readonly [string, keyof typeof colors, keyof typeof colors]> = [
  ["body on paper", "ink", "paper"],
  ["body on mist", "ink", "mist"],
  ["body on panel", "ink", "panel"],
  ["paper on brand (buttons)", "paper", "brand"],
  ["paper on label", "paper", "label"],
  ["ink on needs-OK highlight", "ink", "hlOk"],
  ["secondary on paper", "inkSoft", "paper"],
  ["secondary on mist", "inkSoft", "mist"],
  ["secondary on panel", "inkSoft", "panel"],
  ["error on paper", "danger", "paper"],
  ["demo marker", "warnInk", "warnBg"],
  ["warning banner", "warnAmberInk", "warnAmberBg"],
  ["ink on accent", "ink", "accent"],
  ["secondary on accent", "inkSoft", "accent"]
];

export const spacing = { touch: "48px" } as const; // minimum touch target
