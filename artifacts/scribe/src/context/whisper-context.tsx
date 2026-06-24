import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  useWhisper,
  getStoredModel,
  setStoredModel,
  WHISPER_MODELS,
  type WhisperModelState,
  type WhisperDownloadProgress,
  type WhisperModelId,
} from "@/hooks/use-whisper";
import { getApiTranscriptionSettings } from "@/lib/api-transcribe";

interface WhisperContextValue {
  modelState: WhisperModelState;
  downloadProgress: WhisperDownloadProgress | null;
  modelError: string | null;
  transcribe: (blob: Blob) => Promise<string>;
  /** True when API transcription mode is active (no local model loaded) */
  useApiMode: boolean;
  /** The currently selected Whisper model ID (null in API mode) */
  model: WhisperModelId | null;
  /** Human-readable label for the current model */
  modelLabel: string;
  /** Switch to a different Whisper model — downloads if not cached, then activates */
  loadModel: (id: WhisperModelId) => void;
}

const WhisperContext = createContext<WhisperContextValue | null>(null);

/**
 * Provides the Whisper model at app-root level so it starts loading immediately
 * on boot — not lazily when the user first navigates to the recorder page.
 * This ensures the model is cached in IndexedDB before the user goes offline.
 */
export function WhisperProvider({ children }: { children: ReactNode }) {
  const [apiSettings] = useState(getApiTranscriptionSettings);
  const useApiMode = apiSettings.enabled && !!apiSettings.apiKey.trim();
  const [model, setModel] = useState<WhisperModelId>(getStoredModel);

  const { modelState, downloadProgress, modelError, transcribe } = useWhisper(
    useApiMode ? null : model
  );

  const modelLabel =
    WHISPER_MODELS.find((m) => m.id === model)?.label ?? model;

  const loadModel = useCallback((id: WhisperModelId) => {
    setStoredModel(id);
    setModel(id);
  }, []);

  return (
    <WhisperContext.Provider
      value={{
        modelState,
        downloadProgress,
        modelError,
        transcribe,
        useApiMode,
        model: useApiMode ? null : model,
        modelLabel,
        loadModel,
      }}
    >
      {children}
    </WhisperContext.Provider>
  );
}

export function useWhisperContext(): WhisperContextValue {
  const ctx = useContext(WhisperContext);
  if (!ctx) throw new Error("useWhisperContext must be used inside WhisperProvider");
  return ctx;
}
