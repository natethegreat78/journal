/**
 * Vite config for the Electron desktop build.
 * Differences from vite.config.ts (web/Replit):
 *  - No PORT or BASE_PATH env var requirements
 *  - base: "/" (the Electron Express server serves the app over HTTP)
 *  - No Replit-specific plugins (cartographer, devBanner, runtimeErrorOverlay)
 *  - No PWA service worker (Electron uses its own caching)
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "motion-utils": path.resolve(
        import.meta.dirname,
        "../../node_modules/.pnpm/motion-utils@12.36.0/node_modules/motion-utils/dist/cjs/index.js"
      ),
      "motion-dom": path.resolve(
        import.meta.dirname,
        "../../node_modules/.pnpm/motion-dom@12.38.0/node_modules/motion-dom/dist/es/index.mjs"
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
