import { useState, useRef, useCallback } from "react";

export type RecorderState = "idle" | "recording" | "transcribing" | "done" | "error";

interface UseMediaRecorderResult {
  state: RecorderState;
  duration: number;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setDuration(0);
    durationRef.current = 0;
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("denied") || msg.includes("NotAllowed")) {
        setError("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
      } else if (msg.includes("NotFound") || msg.includes("Requested device")) {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError(`Could not access microphone: ${msg}`);
      }
      setState("error");
      return;
    }

    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);

      const audioBlob = new Blob(chunksRef.current, { type: mimeType });
      if (audioBlob.size < 1000) {
        setError("Recording was too short. Please speak for at least a second.");
        setState("error");
        return;
      }

      setState("transcribing");
      try {
        const formData = new FormData();
        const ext = mimeType.includes("webm") ? "webm" : "mp4";
        formData.append("audio", audioBlob, `recording.${ext}`);

        const res = await fetch("/api/transcripts/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Server error ${res.status}`);
        }

        const data = await res.json() as { text: string };
        setTranscript(data.text);
        setState("done");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setState("error");
      }
    };

    recorder.start(1000);
    setState("recording");

    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    chunksRef.current = [];
    setState("idle");
    setDuration(0);
    setTranscript("");
    setError(null);
    durationRef.current = 0;
  }, []);

  return { state, duration, transcript, error, start, stop, reset };
}
