---
name: Local Whisper transcription
description: How local in-browser Whisper inference is wired up in Scribe
---

## Rule
Transcription runs entirely in the browser via `@huggingface/transformers` in a Web Worker. No API key required. Audio never leaves the device.

**Why:** User chose fully local transcription to eliminate API key dependency for the core recording feature.

## How to apply
- Worker: `artifacts/scribe/src/workers/whisper.worker.ts` — loads the ASR pipeline, receives Float32Array, returns text
- Hook: `artifacts/scribe/src/hooks/use-whisper.ts` — manages worker lifecycle, audio decoding, model loading state, download progress
- Audio decoding happens in the **main thread** (not the worker) using `AudioContext` + `OfflineAudioContext` to resample to 16kHz before transferring Float32Array to the worker. Workers do not have `AudioContext`.
- Model choice is stored in `localStorage` under key `scribe:whisper-model`; options: `Xenova/whisper-tiny`, `Xenova/whisper-base`, `Xenova/whisper-small`
- Vite config excludes `@huggingface/transformers` from dep optimisation (`optimizeDeps.exclude`)
- Groq API key is now **only** needed for optional AI features (summarize, cleanup, autotag) — not for recording/transcription

## Gotchas
- `OfflineAudioContext` is **not** available in Web Workers — always decode audio in the main thread
- On first use the model is downloaded from Hugging Face and cached in IndexedDB; subsequent loads are instant
- `useMediaRecorder` now accepts a `transcribeFn: (blob: Blob) => Promise<string>` parameter — the recorder page wires in `transcribe` from `useWhisper`
