// Single source of truth for design tokens. Tailwind reads this file.
// Greyscale on purpose (current direction); a real palette can replace these values later without touching components.
// Contrast of every text/background pair is verified in tests/contrast.test.ts.
export const colors = {
  brand: "#2E2E2E",     // primary fill (buttons). Text on it is paper.
  brandDeep: "#2E2E2E", // focus ring
  ink: "#2E2E2E",       // body text
  inkSoft: "#484848",   // secondary text
  /** Lightest surface (neutral-100). Cards, sheets, and text on dark buttons. */
  paper: "#F5F5F5",
  mist: "#ECECEC",      // page background
  panel: "#D4D4D4",     // work-order panel
  line: "#C8C8C8",      // borders (non-text)
  label: "#1A1A1A",     // field labels. Text on them is paper.
  hlOk: "#A0A0A0",      // highlight: needs your OK. Also the house's mid-grey walls.
  /** Neutral charcoal for trim and blueprint outlines. */
  charcoal: "#3A3A3A",
  danger: "#1A1A1A",    // errors are marked with weight and borders, not hue
  warnBg: "#E6E6E6",    // demo-value marker
  warnInk: "#2E2E2E",
  warnAmberBg: "#FFE8A3",  // pending-review banner
  warnAmberInk: "#3F2A00",
  /** Hub accent. Backgrounds only (hero card, stat tiles, status dot, selected shortcut), with ink on top. Never text, and never a thin icon on the lightest surface. */
  accent: "#DFFF32"
} as const;

/** How much of the surface shows through a liquid-glass card. */
export const GLASS_ALPHA = 0.62;
/** The sheet on the lime hero is opaque, so the accent does not tint the type. */
export const GLASS_SHEET_ALPHA = 1;
export const GLASS_LIME_ALPHA = 0.84;

export function rgbChannels(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

export function rgbaFrom(hex: string, alpha: number): string {
  const [r, g, b] = rgbChannels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  ["secondary on accent", "inkSoft", "accent"],
  ["paper on charcoal", "paper", "charcoal"]
];

export const spacing = { touch: "48px" } as const; // minimum touch target
