import { useRef, useState, useCallback } from "react";

export type SummarizerStatus = "idle" | "loading-model" | "summarizing" | "error";

export interface SummarizerDownloadProgress {
  file: string;
  loaded: number;
  total: number;
  progress: number;
}

export function useSummarizer() {
  const [status, setStatus] = useState<SummarizerStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<SummarizerDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<{
    resolve: (summary: string) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const getWorker = useCallback((): Promise<Worker> => {
    if (workerRef.current) return Promise.resolve(workerRef.current);

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
          // Also reject the getWorker promise if we haven't resolved yet
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

      worker.postMessage({ type: "load" });
    });
  }, []);

  const summarize = useCallback(
    async (text: string): Promise<string> => {
      const worker = await getWorker();
      setStatus("summarizing");
      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        worker.postMessage({ type: "summarize", text });
      });
    },
    [getWorker]
  );

  const isModelLoaded = status !== "loading-model" && !!workerRef.current;

  return {
    /** Current status of the summarizer */
    status,
    /** True while the model is downloading or summarizing */
    isBusy: status === "loading-model" || status === "summarizing",
    /** True only while model files are being downloaded */
    isDownloading: status === "loading-model",
    /** True only while the model is generating a summary */
    isSummarizing: status === "summarizing",
    /** True once the model has been loaded at least once this session */
    isModelLoaded,
    /** Download progress (file name + percentage) — only set while downloading */
    downloadProgress,
    /** Error message, if status === "error" */
    error,
    /** Summarize text. Lazy-loads the model on first call. */
    summarize,
  };
}
