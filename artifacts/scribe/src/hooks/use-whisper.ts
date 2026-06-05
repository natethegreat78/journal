import { useEffect, useRef, useState, useCallback } from "react";

export type WhisperModelState = "loading" | "ready" | "error";

export interface WhisperDownloadProgress {
  file: string;
  loaded: number;
  total: number;
  progress: number;
}

export const WHISPER_MODELS = [
  { id: "Xenova/whisper-tiny", label: "Tiny — Fastest (~80 MB)", description: "Best for quick notes" },
  { id: "Xenova/whisper-base", label: "Base — Balanced (~145 MB)", description: "Good accuracy, still fast" },
  { id: "Xenova/whisper-small", label: "Small — Most accurate (~480 MB)", description: "Best quality, slower first load" },
] as const;

export type WhisperModelId = (typeof WHISPER_MODELS)[number]["id"];

const STORAGE_KEY = "scribe:whisper-model";

export function getStoredModel(): WhisperModelId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && WHISPER_MODELS.some((m) => m.id === stored)) {
      return stored as WhisperModelId;
    }
  } catch {}
  return "Xenova/whisper-tiny";
}

export function setStoredModel(model: WhisperModelId) {
  try {
    localStorage.setItem(STORAGE_KEY, model);
  } catch {}
}

async function decodeAudioTo16kHz(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const targetRate = 16000;
  if (decoded.sampleRate === targetRate) {
    return decoded.getChannelData(0);
  }

  const lengthAtTarget = Math.ceil(decoded.duration * targetRate);
  const offlineCtx = new OfflineAudioContext(1, lengthAtTarget, targetRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampled = await offlineCtx.startRendering();
  return resampled.getChannelData(0);
}

export function useWhisper(model: WhisperModelId) {
  const [modelState, setModelState] = useState<WhisperModelState>("loading");
  const [downloadProgress, setDownloadProgress] = useState<WhisperDownloadProgress | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<{
    resolve: (text: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  useEffect(() => {
    setModelState("loading");
    setDownloadProgress(null);
    setModelError(null);

    const worker = new Worker(
      new URL("../workers/whisper.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string;
        info?: unknown;
        text?: string;
        message?: string;
      };

      if (msg.type === "progress") {
        const info = msg.info as { status?: string; file?: string; loaded?: number; total?: number; progress?: number } | undefined;
        if (info?.status === "download" && info.total && info.total > 0) {
          setDownloadProgress({
            file: info.file ?? "",
            loaded: info.loaded ?? 0,
            total: info.total,
            progress: info.progress ?? 0,
          });
        }
      } else if (msg.type === "ready") {
        setModelState("ready");
        setDownloadProgress(null);
      } else if (msg.type === "result") {
        if (pendingRef.current) {
          pendingRef.current.resolve(msg.text ?? "");
          pendingRef.current = null;
        }
      } else if (msg.type === "error") {
        const errorMsg = msg.message ?? "Unknown error";
        setModelError(errorMsg);
        setModelState("error");
        if (pendingRef.current) {
          pendingRef.current.reject(new Error(errorMsg));
          pendingRef.current = null;
        }
      }
    };

    worker.onerror = (e) => {
      const msg = e.message ?? "Worker crashed";
      setModelError(msg);
      setModelState("error");
      if (pendingRef.current) {
        pendingRef.current.reject(new Error(msg));
        pendingRef.current = null;
      }
    };

    worker.postMessage({ type: "load", model });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [model]);

  const transcribe = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      const worker = workerRef.current;
      if (!worker) throw new Error("Transcription worker not initialized");

      const float32 = await decodeAudioTo16kHz(audioBlob);

      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        worker.postMessage({ type: "transcribe", audio: float32, model }, [float32.buffer]);
      });
    },
    [model]
  );

  return { modelState, downloadProgress, modelError, transcribe };
}
