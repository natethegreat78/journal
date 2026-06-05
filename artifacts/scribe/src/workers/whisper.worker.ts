import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

type ASRPipeline = Awaited<ReturnType<typeof pipeline<"automatic-speech-recognition">>>;

let transcriber: ASRPipeline | null = null;
let loadedModel = "";

async function getTranscriber(model: string): Promise<ASRPipeline> {
  if (transcriber && loadedModel === model) return transcriber;

  transcriber = await pipeline("automatic-speech-recognition", model, {
    progress_callback: (info: unknown) => {
      self.postMessage({ type: "progress", info });
    },
  });
  loadedModel = model;
  return transcriber;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, audio, model } = event.data as {
    type: string;
    audio?: Float32Array;
    model?: string;
  };

  const modelId = model ?? "Xenova/whisper-tiny";

  if (type === "load") {
    try {
      await getTranscriber(modelId);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (type === "transcribe" && audio) {
    try {
      const t = await getTranscriber(modelId);
      const result = await t(audio, { sampling_rate: 16000 });
      const text = Array.isArray(result)
        ? (result[0]?.text ?? "")
        : ((result as { text?: string }).text ?? "");
      self.postMessage({ type: "result", text: text.trim() });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
});
