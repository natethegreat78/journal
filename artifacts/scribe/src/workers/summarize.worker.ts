import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;
(env.backends.onnx.wasm as { wasmPaths?: string }).wasmPaths = "/ort/";

type SummarizePipeline = Awaited<ReturnType<typeof pipeline<"summarization">>>;

let summarizer: SummarizePipeline | null = null;
let loadedModel = "";

// distilbart models have a 1024 token limit. 700 words ≈ 900 tokens — safe headroom.
const MAX_WORDS_PER_CHUNK = 700;

function chunkText(text: string, maxWords = MAX_WORDS_PER_CHUNK): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

function extractSummaryText(result: unknown): string {
  if (Array.isArray(result)) {
    return (result[0] as { summary_text?: string })?.summary_text ?? "";
  }
  return (result as { summary_text?: string })?.summary_text ?? "";
}

async function getSummarizer(model: string): Promise<SummarizePipeline> {
  if (summarizer && loadedModel === model) return summarizer;
  summarizer = await pipeline("summarization", model, {
    dtype: "fp32",
    device: "wasm",
    progress_callback: (info: unknown) => {
      self.postMessage({ type: "progress", info });
    },
  });
  loadedModel = model;
  return summarizer;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, text, model } = event.data as {
    type: string;
    text?: string;
    model?: string;
  };

  const modelId = model ?? "Xenova/distilbart-cnn-6-6";

  if (type === "load") {
    try {
      await getSummarizer(modelId);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (type === "summarize" && text) {
    try {
      const s = await getSummarizer(modelId);
      const chunks = chunkText(text);
      const chunkSummaries: string[] = [];

      for (const chunk of chunks) {
        const wordCount = chunk.split(/\s+/).length;
        const maxNew = Math.min(150, Math.max(40, Math.floor(wordCount * 0.25)));
        const minNew = Math.min(30, Math.floor(maxNew * 0.4));

        const result = await s(chunk, {
          max_new_tokens: maxNew,
          min_new_tokens: minNew,
        });
        const summary = extractSummaryText(result).trim();
        if (summary) chunkSummaries.push(summary);
      }

      let finalSummary = chunkSummaries.join(" ");

      // If chunked summaries are still long, run a second-pass compression.
      if (chunkSummaries.length > 1 && finalSummary.split(/\s+/).length > MAX_WORDS_PER_CHUNK) {
        const meta = await s(finalSummary, { max_new_tokens: 200, min_new_tokens: 40 });
        finalSummary = extractSummaryText(meta).trim() || finalSummary;
      }

      self.postMessage({ type: "result", summary: finalSummary });
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
});
