import type { Config } from "tailwindcss";
import { colors, spacing } from "./src/ui/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
      minHeight: { touch: spacing.touch },
      minWidth: { touch: spacing.touch },
      // Hangul-capable fallbacks; Spanish runs 20-30% longer, so never fix widths on text.
      fontFamily: {
        sans: ["Atkinson Hyperlegible", "Noto Sans KR", "system-ui", "Segoe UI", "Roboto", "sans-serif"]
      },
      fontSize: { base: ["1.125rem", "1.65rem"] } // large default text
    }
  },
  plugins: []
} satisfies Config;
