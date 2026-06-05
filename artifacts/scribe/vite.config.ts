import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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
