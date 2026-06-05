# Building Scribe for Mac Intel

Scribe runs as a full web app in Replit (with PostgreSQL), and also as a downloadable Mac desktop app (with local SQLite storage). Follow these steps to build the `.dmg` installer for Mac Intel.

## Prerequisites

- **Mac Intel** computer (x86_64)
- **Node.js 20+** — download from https://nodejs.org
- **pnpm** — run `npm install -g pnpm`
- **Xcode Command Line Tools** — run `xcode-select --install` (needed for native modules)

## Steps

### 1. Download the code

Download this project from Replit (File → Download as zip) and unzip it.

### 2. Install dependencies

```bash
cd /path/to/project
pnpm install
```

### 3. Build the Mac app

```bash
cd artifacts/scribe
npm run electron:build
```

This will:
1. Build the React frontend (Vite)
2. Compile the Electron main process (TypeScript)
3. Package everything into a `.dmg` and `.zip` in `artifacts/scribe/dist/release/`

### 4. Install

Open `dist/release/Scribe-1.0.0.dmg` and drag Scribe to your Applications folder.

## Where your data lives

All transcripts and settings are stored in:
```
~/Library/Application Support/Scribe/scribe.db
```

This is a standard SQLite database file. You can back it up, copy it, or open it with any SQLite viewer.

## OpenAI API key (for AI features)

The AI features (Summarize, Clean Filler Words, Auto-Tag) require an OpenAI API key:
1. Get one at https://platform.openai.com/api-keys
2. Open Scribe → Settings → paste your API key
3. The key is stored locally in your SQLite database — it never leaves your machine except when making API calls to OpenAI

## Speech recognition

Scribe uses your Mac's built-in speech recognition (via Chrome/Electron's Web Speech API). No audio is sent anywhere — transcription happens entirely on your computer. You may be prompted to grant microphone access the first time you record.

## Troubleshooting

- **"App is damaged"** — Right-click the app and choose Open, or run: `xattr -d com.apple.quarantine /Applications/Scribe.app`
- **Microphone not working** — Go to System Preferences → Security & Privacy → Microphone and ensure Scribe is allowed
- **Build fails with native module error** — Ensure Xcode Command Line Tools are installed: `xcode-select --install`
