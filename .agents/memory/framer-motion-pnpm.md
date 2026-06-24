---
name: framer-motion v12 pnpm resolution
description: framer-motion v12 peer deps (motion-utils, motion-dom) are not hoisted by pnpm, breaking Vite's dep optimizer. Fix via resolve.alias in vite.config.ts.
---

## Problem
framer-motion v12+ re-exports from `motion-utils` and `motion-dom` as peer packages. pnpm's strict hoisting does not create root-level symlinks for them, so Vite's esbuild optimizer can't find them during `vite:dep-pre-bundle`. Error: "Failed to resolve entry for package 'motion-utils'".

Symlinking to workspace root `node_modules` does NOT fix it — Vite's optimizer resolves from the framer-motion package directory context, not the workspace root.

## Fix
Add explicit `resolve.alias` in `vite.config.ts` pointing to the compiled dist files in the pnpm content-addressable store:

```ts
resolve: {
  alias: {
    "motion-utils": path.resolve(
      import.meta.dirname,
      "../../node_modules/.pnpm/motion-utils@<VERSION>/node_modules/motion-utils/dist/cjs/index.js"
    ),
    "motion-dom": path.resolve(
      import.meta.dirname,
      "../../node_modules/.pnpm/motion-dom@<VERSION>/node_modules/motion-dom/dist/es/index.mjs"
    ),
  }
}
```

**Why:** motion-utils@12.36.0 has a broken ESM export map (`dist/es/index.mjs` listed but doesn't exist) — use CJS (`dist/cjs/index.js`) for motion-utils. motion-dom@12.38.0 has a working `dist/es/index.mjs`.

**How to apply:** Check actual versions with `ls node_modules/.pnpm/ | grep "^motion-"`. Update version strings in alias if packages change.
