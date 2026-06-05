---
name: Web Speech API in Replit
description: Chrome SpeechRecognition causes "network" error in Replit's proxied preview; use MediaRecorder + Whisper instead.
---

## Rule
Do NOT use the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) in this project.

## Why
Chrome's Web Speech API streams audio to Google's servers for transcription. In Replit's proxied iframe environment that connection is blocked, producing `event.error === "network"` immediately on start. The API is also not truly local — audio leaves the device.

## How to apply
Use `MediaRecorder` (browser native, no network required) to capture audio chunks into a Blob, then POST the Blob as multipart `form-data` to `POST /api/transcripts/transcribe`. That route accepts the audio with multer (memoryStorage), forwards it to OpenAI's Whisper API (`/v1/audio/transcriptions`, model `whisper-1`), and returns `{ text: string }`.

The hook lives at `artifacts/scribe/src/hooks/use-media-recorder.ts`. Recording works without any API key; transcription requires the user's OpenAI key stored in settings.
