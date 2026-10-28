---
name: Local Whisper transcription
description: Local transcription privacy, runtime compatibility, and inference verification constraints
---

## Local transcription
Keep core transcription fully on-device and usable without an API key.

**Why:** User chose fully local transcription to eliminate API key dependency for the core recording feature.

**How to apply:** Do not replace local transcription with a cloud provider merely to improve accuracy or speed; cloud transcription must remain an explicit opt-in.

## Runtime compatibility
The ONNX JavaScript loader and locally served WASM/module files must come from the exact same installed dependency version, with versioned URLs.

**Why:** Updating Transformers alone does not update copied runtime binaries. Old local WASM can retain the quantized Whisper `Missing required scale` / `MatMulNBits` optimizer bug even when the installed library includes the upstream fix. Browser caching can retain those stale files too.

**How to apply:** Resolve runtime assets from Transformers' installed ONNX dependency for development and both web/desktop builds; do not restore hand-copied, unversioned binaries.

## Verify inference, not just download
Changes to the model, precision, or inference runtime require a real browser model-ready event and a successful sample transcription before delivery.

**Why:** A passing build, advertised model-file availability, and a screenshot saying “Preparing model” do not prove session creation or inference works.

**How to apply:** Keep browser checks narrowly focused on actual model loading and known speech through the real worker; do not mock ready/results or modify saved user transcripts.

## Audio decoding boundary
Decode and resample audio on the main thread before sending samples to a Web Worker.

**Why:** Workers do not provide `AudioContext` or `OfflineAudioContext`.

**How to apply:** Use the worker for inference, not Web Audio decoding.
