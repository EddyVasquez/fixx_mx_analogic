// Single source of truth for design tokens. Tailwind reads the names; index.css
// maps them to CSS variables so a dark theme can restyle the whole app.
// Greyscale on purpose. Lime is the only chromatic accent, and it is a background.
// Contrast of every text/background pair is verified in tests/contrast.test.ts.
export const colors = {
  brand: "#2E2E2E",     // primary fill (buttons). Text on it is paper.
  brandDeep: "#2E2E2E", // focus ring
  ink: "#2E2E2E",       // body text
  inkSoft: "#484848",   // secondary text
  paper: "#D4D4D4",     // section cards and light text. Not white.
  mist: "#ECECEC",      // page background
  panel: "#D4D4D4",     // work-order panel
  line: "#C8C8C8",      // borders (non-text)
  label: "#1A1A1A",     // field labels (paper text)
  hlOk: "#A0A0A0",      // highlight: needs your OK
  danger: "#1A1A1A",    // errors are marked with weight and borders, not hue
  warnBg: "#E6E6E6",    // demo-value marker
  warnInk: "#2E2E2E",
  warnAmberBg: "#FFE8A3",  // pending-review banner
  warnAmberInk: "#3F2A00",
  /** Text and icons that sit on the lime accent. Stays charcoal in both themes. */
  onAccent: "#2E2E2E",
  /** Hub accent. Backgrounds only: the My Home hero, stat tiles, trade plus buttons, and the job spotlight. Never text. */
  accent: "#DFFF32"
} as const;

/** Dark theme. Near-black base, two grey surfaces, light grey text. Never pure white. Lime stays. */
export const darkColors: { [K in keyof typeof colors]: string } = {
  brand: "#E0E0E0",
  brandDeep: "#E0E0E0",
  ink: "#E0E0E0",
  inkSoft: "#A8A8A8",
  paper: "#1E1E1E",
  mist: "#121212",
  panel: "#2A2A2A",
  line: "#4A4A4A",
  label: "#E0E0E0",
  hlOk: "#3A3A3A",
  danger: "#E0E0E0",
  warnBg: "#3A3A3A",
  warnInk: "#E0E0E0",
  warnAmberBg: "#FFE8A3",
  warnAmberInk: "#3F2A00",
  onAccent: "#2E2E2E",
  accent: "#DFFF32"
};

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
  ["charcoal on accent", "onAccent", "accent"]
];

export const darkTextPairs: ReadonlyArray<readonly [string, keyof typeof darkColors, keyof typeof darkColors]> = [
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
  ["charcoal on accent", "onAccent", "accent"]
];

export const spacing = { touch: "48px" } as const; // minimum touch target
