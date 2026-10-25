import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// GitHub Pages project site: https://eddyvasquez.github.io/fixx_mx_analogic/
// Asset URLs must include this prefix or the built page loads a blank #root.
const BASE = "/fixx_mx_analogic/";

export default defineConfig({
  base: BASE,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker registration scope. Defaults to Vite base; set explicitly so it matches the manifest.
      scope: BASE,
      manifest: {
        name: "FIXX (Demo)",
        short_name: "FIXX",
        display: "standalone",
        background_color: "#FFFFFF",
        theme_color: "#2E2E2E",
        start_url: BASE,
        scope: BASE
      }
    })
  ],
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
});
