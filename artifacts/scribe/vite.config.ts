import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { readFileSync, existsSync } from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

/**
 * Serves files from public/ort/ at /ort/ via raw middleware (before Vite's
 * module resolver), so dynamic import('/ort/*.mjs') in the ONNX Runtime Web
 * worker doesn't trigger Vite's "public dir cannot be imported" error.
 */
function ortStaticServe(): Plugin {
  const ortDir = path.resolve(import.meta.dirname, "public", "ort");
  return {
    name: "ort-static-serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/ort/")) return next();
        const filename = url.slice("/ort/".length).split("?")[0];
        const filePath = path.join(ortDir, filename);
        if (!existsSync(filePath)) return next();
        const isWasm = filename.endsWith(".wasm");
        const isMjs = filename.endsWith(".mjs");
        if (!isWasm && !isMjs) return next();
        const content = readFileSync(filePath);
        res.setHeader("Content-Type", isWasm ? "application/wasm" : "text/javascript; charset=utf-8");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "max-age=86400");
        res.end(content);
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    ortStaticServe(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    // PWA: caches the app shell so the recorder + file workflow load offline.
    // ORT WASM files (~60 MB) are intentionally excluded — they're already
    // cached by transformers.js in the browser's IndexedDB after first use.
    // The /api/* routes always go to network; they fail gracefully when offline.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: { enabled: false },
      workbox: {
        // Only precache app shell assets — NOT .wasm/.mjs (the ORT files)
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        globIgnores: ["ort/**", "**/ort/**"],
        // Serve cached index.html for any SPA navigation when offline
        navigateFallback: `${basePath}index.html`.replace(/\/\//g, "/"),
        // Don't intercept API or ORT requests with the HTML fallback
        navigateFallbackDenylist: [/^\/api\//, /\/ort\//, /\.(wasm|mjs)$/],
        runtimeCaching: [
          {
            // API calls always go to network — fail loudly offline rather than silently
            urlPattern: /\/api\//,
            handler: "NetworkOnly",
          },
          {
            // Google Fonts CSS (online-only; app degrades to system font offline)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Journal — Local Transcription",
        short_name: "Journal",
        description: "Record your thoughts, transcribe locally, and journal — everything stays on your device.",
        theme_color: "#FF3C00",
        background_color: "#ffffff",
        display: "standalone",
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
