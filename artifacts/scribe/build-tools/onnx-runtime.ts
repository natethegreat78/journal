import { createReadStream, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * ONNX's JavaScript loader and WASM binaries must come from the same version.
 * Resolve through Transformers so pnpm's dependency isolation is respected.
 * Versioned URLs also prevent an older cached WASM binary being reused.
 */
export function localOnnxRuntime(): Plugin {
  const require = createRequire(import.meta.url);
  const transformersRequire = createRequire(
    require.resolve("@huggingface/transformers"),
  );
  const runtimeDir = path.dirname(
    transformersRequire.resolve("onnxruntime-web"),
  );
  const { version } = JSON.parse(
    readFileSync(path.join(runtimeDir, "..", "package.json"), "utf8"),
  ) as { version: string };
  const files = readdirSync(runtimeDir).filter((file) =>
    /^ort-wasm-simd-threaded(?:\.(?:asyncify|jsep|jspi))?\.(?:mjs|wasm)$/.test(file),
  );
  const assetDir = `ort/${version}/`;

  if (!files.length) {
    throw new Error(`No ONNX runtime assets found in ${runtimeDir}`);
  }

  return {
    name: "local-onnx-runtime",
    config: () => ({
      define: {
        "import.meta.env.VITE_ONNX_RUNTIME_VERSION": JSON.stringify(version),
      },
    }),
    configureServer(server) {
      const prefix = `${server.config.base}${assetDir}`;
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith(prefix)) return next();
        const filename = url.slice(prefix.length);
        if (!files.includes(filename)) return next();

        res.setHeader(
          "Content-Type",
          filename.endsWith(".wasm")
            ? "application/wasm"
            : "text/javascript; charset=utf-8",
        );
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        createReadStream(path.join(runtimeDir, filename))
          .on("error", next)
          .pipe(res);
      });
    },
    generateBundle() {
      for (const file of files) {
        this.emitFile({
          type: "asset",
          fileName: `${assetDir}${file}`,
          source: readFileSync(path.join(runtimeDir, file)),
        });
      }
    },
  };
}
