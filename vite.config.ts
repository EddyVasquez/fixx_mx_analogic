import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "FIXX (Demo)", short_name: "FIXX", display: "standalone",
        background_color: "#FFFFFF", theme_color: "#2E2E2E", start_url: "/"
      }
    })
  ],
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
});
