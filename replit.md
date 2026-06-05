# Scribe

A local-first transcription app: record speech, transcribe in real time, clean filler words, summarize, and tag — everything stored on your own computer.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/scribe run dev` — run the React frontend (port 20804)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (Replit provides this)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (Replit web version); SQLite + better-sqlite3 (Electron desktop version)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Frontend: React + Vite, TanStack Query, Wouter, shadcn/ui, Framer Motion
- AI: OpenAI API (user-provided key) — summarization, filler word cleanup, auto-tagging
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Desktop: Electron 33 + electron-builder (Mac Intel)
- Transcription: Web Speech API (browser built-in, fully local)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema (transcripts, tags, transcript_tags, settings)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/scribe/src/` — React frontend
- `artifacts/scribe/electron/` — Electron main process + SQLite backend for Mac app
- `artifacts/scribe/BUILDING_MAC_APP.md` — instructions for building the .dmg

## Architecture decisions

- **Two backends**: The Replit-hosted version uses PostgreSQL; the Electron desktop app uses a bundled SQLite server (`electron/server.ts`). Both expose identical REST APIs so the React frontend is shared.
- **Web Speech API for transcription**: Runs entirely in the browser/Chromium renderer — no audio data leaves the device.
- **Settings stored in DB**: OpenAI API key is stored in the `settings` table (masked in responses). For Electron, stored in the local SQLite file.
- **Local file export**: Transcript export is done client-side (File System Access API / Electron save dialog) — no server involvement.

## Product

- **Record** — tap the microphone, speak naturally, see your words appear in real time
- **Library** — browse, search, and filter all transcripts by keyword or tag
- **Detail** — view raw or cleaned transcript, run AI cleanup/summarization/auto-tagging
- **Settings** — configure OpenAI API key for AI features; all other functionality is offline

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Electron app requires building on Mac Intel — see `artifacts/scribe/BUILDING_MAC_APP.md`
- better-sqlite3 requires native binaries; electron-builder handles recompilation via `npmRebuild: true`
- The `/api/transcripts/stats` route must come BEFORE `/api/transcripts/:id` in Express to avoid route matching conflicts

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
