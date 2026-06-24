export const SUMMARIZATION_MODELS = [
  {
    id: "Xenova/distilbart-cnn-6-6",
    label: "DistilBART CNN 6-6",
    description: "Compact and fast. Great for short-to-medium transcripts.",
    sizeMb: 220,
    maxWordsPerChunk: 700,
  },
  {
    id: "Xenova/distilbart-cnn-12-6",
    label: "DistilBART CNN 12-6",
    description: "More layers, higher quality. Better for long or complex transcripts.",
    sizeMb: 306,
    maxWordsPerChunk: 700,
  },
  {
    id: "Xenova/distilbart-xsum-12-6",
    label: "DistilBART XSum 12-6",
    description: "Generates shorter, punchier one-paragraph summaries.",
    sizeMb: 306,
    maxWordsPerChunk: 700,
  },
] as const;

export type SummarizationModelId = (typeof SUMMARIZATION_MODELS)[number]["id"];

const STORAGE_KEY = "scribe:summarization-model";

export function getStoredSummarizationModel(): SummarizationModelId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUMMARIZATION_MODELS.some((m) => m.id === stored)) {
      return stored as SummarizationModelId;
    }
  } catch {}
  return "Xenova/distilbart-cnn-6-6";
}

export function setStoredSummarizationModel(model: SummarizationModelId) {
  try {
    localStorage.setItem(STORAGE_KEY, model);
  } catch {}
}
