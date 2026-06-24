import { useRef, useState, useCallback } from "react";
import {
  getStoredSummarizationModel,
  type SummarizationModelId,
} from "@/lib/summarization-models";

export type SummarizerStatus = "idle" | "loading-model" | "summarizing" | "error";

export interface SummarizerDownloadProgress {
  file: string;
  loaded: number;
  total: number;
  progress: number;
}

/**
 * Lazy-loads a summarization model in a Web Worker on first use.
 * Pass `model` to override the stored preference for this hook instance.
 */
export function useSummarizer(model?: SummarizationModelId) {
  const [status, setStatus] = useState<SummarizerStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<SummarizerDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const loadedModelRef = useRef<string | null>(null);
  const pendingRef = useRef<{
    resolve: (summary: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const getWorker = useCallback(
    (modelId: string): Promise<Worker> => {
      // Reuse existing worker if it has the same model loaded
      if (workerRef.current && loadedModelRef.current === modelId) {
        return Promise.resolve(workerRef.current);
      }

      // Terminate old worker if model changed
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        loadedModelRef.current = null;
      }

      return new Promise((resolve, reject) => {
        setStatus("loading-model");
        setDownloadProgress(null);
        setError(null);

        const worker = new Worker(
          new URL("../workers/summarize.worker.ts", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data as {
            type: string;
            info?: unknown;
            summary?: string;
            message?: string;
          };

          if (msg.type === "progress") {
            const info = msg.info as {
              status?: string;
              file?: string;
              loaded?: number;
              total?: number;
              progress?: number;
            } | undefined;
            if (info?.status === "download" && info.total && info.total > 0) {
              setDownloadProgress({
                file: info.file ?? "",
                loaded: info.loaded ?? 0,
                total: info.total,
                progress: info.progress ?? 0,
              });
            }
          } else if (msg.type === "ready") {
            loadedModelRef.current = modelId;
            setStatus("idle");
            setDownloadProgress(null);
            resolve(worker);
          } else if (msg.type === "result") {
            setStatus("idle");
            if (pendingRef.current) {
              pendingRef.current.resolve(msg.summary ?? "");
              pendingRef.current = null;
            }
          } else if (msg.type === "error") {
            const errMsg = msg.message ?? "Unknown error";
            setError(errMsg);
            setStatus("error");
            setDownloadProgress(null);
            if (pendingRef.current) {
              pendingRef.current.reject(new Error(errMsg));
              pendingRef.current = null;
            }
            reject(new Error(errMsg));
          }
        };

        worker.onerror = (e) => {
          const msg = e.message ?? "Worker crashed";
          setError(msg);
          setStatus("error");
          setDownloadProgress(null);
          if (pendingRef.current) {
            pendingRef.current.reject(new Error(msg));
            pendingRef.current = null;
          }
          reject(new Error(msg));
        };

        worker.postMessage({ type: "load", model: modelId });
      });
    },
    []
  );

  const summarize = useCallback(
    async (text: string): Promise<string> => {
      const modelId = model ?? getStoredSummarizationModel();
      const worker = await getWorker(modelId);
      setStatus("summarizing");
      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        worker.postMessage({ type: "summarize", text, model: modelId });
      });
    },
    [model, getWorker]
  );

  const isModelLoaded = status !== "loading-model" && !!workerRef.current;

  return {
    status,
    isBusy: status === "loading-model" || status === "summarizing",
    isDownloading: status === "loading-model",
    isSummarizing: status === "summarizing",
    isModelLoaded,
    downloadProgress,
    error,
    summarize,
  };
}
