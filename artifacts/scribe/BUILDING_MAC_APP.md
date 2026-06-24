# Building Journal for Mac Intel

Journal is a local-first transcription app. This guide covers building the `.dmg` installer for Mac Intel (x86_64). The desktop app uses SQLite instead of PostgreSQL, so all your data stays entirely on your machine.

## How offline transcription works

Journal uses **Whisper** (via ONNX/WebAssembly) for transcription — no audio ever leaves your Mac. The Whisper model files (~40–244 MB depending on which you pick) are downloaded from the internet **once** on first launch and then cached by Chromium inside the app's data directory. After that initial download, the app works fully offline — no internet connection required.

The AI summarization model works the same way: downloaded once, cached locally, offline forever after.

## Prerequisites (all free)

| Tool | Download |
|------|----------|
| Mac Intel (x86_64) | — |
| Node.js 20+ | https://nodejs.org |
| pnpm | `npm install -g pnpm` |
| Xcode Command Line Tools | `xcode-select --install` |

## Build steps

### 1. Download the project

In Replit, click **⋮ → Download as zip**, then unzip it somewhere on your Mac.

### 2. Install dependencies

```bash
cd /path/to/project
pnpm install
```

### 3. Build the DMG

```bash
cd artifacts/scribe
pnpm run electron:build
```

This single command does three things in sequence:
1. **Builds the React app** with Vite (using the Electron-specific config — no PORT/BASE_PATH needed)
2. **Compiles the Electron main process** TypeScript → JavaScript
3. **Packages everything** into a `.dmg` and `.zip` in `artifacts/scribe/dist/release/`

The output file will be: `dist/release/Journal-1.0.0.dmg`

### 4. Install

Open `Journal-1.0.0.dmg` → drag Journal to your Applications folder → eject the DMG.

## First launch

1. Open Journal from Applications.
2. **Grant microphone access** when macOS asks — required for recording.
3. The app immediately starts downloading the default Whisper model (Tiny English, ~40 MB). You'll see a "Preparing offline model…" indicator in the bottom-left of the sidebar.
4. Once the progress bar completes and shows ✓, transcription is ready. **All future launches are fully offline.**

## Choosing a different transcription model

In the app, go to **Settings → Transcription Models**. Six Whisper variants are available:

| Model | Size | Best for |
|-------|------|----------|
| Tiny (English) | ~40 MB | Quick English notes — default |
| Tiny (Multilingual) | ~40 MB | 99 languages, same speed |
| Base (English) | ~80 MB | Better accuracy |
| Base (Multilingual) | ~80 MB | Accurate, 99 languages |
| Small (English) | ~244 MB | High accuracy |
| Small (Multilingual) | ~244 MB | Best quality, all languages |

Click **Download & Use** on any model. It downloads once and is cached permanently.

## Choosing a summarization model

Go to **Settings → Local Summarization Models** to pick from three DistilBART variants (~220–306 MB). These are used when you click "Summarize" on a transcript **without** a Groq API key. They run entirely locally.

## Where your data lives

| What | Location |
|------|----------|
| Transcripts & settings | `~/Library/Application Support/Journal/journal.db` |
| Whisper model cache | `~/Library/Application Support/Journal/Cache/` |
| Summarization model cache | Same Chromium cache directory |

The database is a standard SQLite file — open it with any SQLite viewer or back it up by copying it.

## AI cleanup / summarization via Groq (optional)

For cloud-based summarization, filler-word cleanup, and auto-tagging:
1. Get a free key at https://console.groq.com/keys
2. Open Journal → Settings → paste your Groq API key → Save
3. The key is stored in your local SQLite database — never sent anywhere except Groq's API

## Troubleshooting

**"App is damaged" or "can't be opened"**
```bash
xattr -d com.apple.quarantine /Applications/Journal.app
```
Or: right-click the app → Open → Open anyway.

**Microphone not working**
System Settings → Privacy & Security → Microphone → enable Journal.

**Build fails: native module error**
```bash
xcode-select --install
```
Then retry `pnpm run electron:build`.

**Build fails: pnpm workspace error**
Make sure you're running `pnpm install` from the **project root** (not inside `artifacts/scribe`).

**Transcription never starts / no model download**
On first launch, you need an internet connection to download the Whisper model. Once it's cached, the app works offline. Check the sidebar indicator — if it shows an error, open Settings → Transcription Models → click **Download & Use** on Whisper Tiny (English).
