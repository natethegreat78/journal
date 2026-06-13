export interface ApiTranscriptionSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "scribe:api-transcription";

export const API_TRANSCRIPTION_PRESETS = [
  {
    label: "Groq — Whisper (free tier)",
    baseUrl: "https://api.groq.com/openai",
    model: "whisper-large-v3-turbo",
    keyHint: "gsk_…",
    keyLink: "https://console.groq.com/keys",
  },
  {
    label: "OpenAI — Whisper",
    baseUrl: "https://api.openai.com",
    model: "whisper-1",
    keyHint: "sk-…",
    keyLink: "https://platform.openai.com/api-keys",
  },
  {
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    model: "whisper-1",
    keyHint: "API key…",
    keyLink: null,
  },
] as const;

const DEFAULTS: ApiTranscriptionSettings = {
  enabled: false,
  baseUrl: API_TRANSCRIPTION_PRESETS[0].baseUrl,
  apiKey: "",
  model: API_TRANSCRIPTION_PRESETS[0].model,
};

export function getApiTranscriptionSettings(): ApiTranscriptionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ApiTranscriptionSettings>;
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function setApiTranscriptionSettings(s: ApiTranscriptionSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export async function transcribeViaApi(
  blob: Blob,
  settings: ApiTranscriptionSettings,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("No API key configured. Add one in Settings → API Transcription.");
  }

  const form = new FormData();
  // Some APIs require a filename with a known extension to detect format
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  form.append("file", blob, `audio.${ext}`);
  form.append("model", settings.model);

  const base = settings.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`API error ${res.status}: ${detail || res.statusText}`);
  }

  const data = await res.json() as { text?: string };
  return (data.text ?? "").trim();
}
