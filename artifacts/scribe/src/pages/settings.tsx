import { useGetSettings, getGetSettingsQueryKey, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Key, HardDrive, Cpu, Loader2, Save, ExternalLink, Mic, Globe, Brain } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WHISPER_MODELS, type WhisperModelId } from "@/hooks/use-whisper";
import { useWhisperContext } from "@/context/whisper-context";
import {
  SUMMARIZATION_MODELS,
  getStoredSummarizationModel,
  setStoredSummarizationModel,
  type SummarizationModelId,
} from "@/lib/summarization-models";
import {
  getApiTranscriptionSettings,
  setApiTranscriptionSettings,
  API_TRANSCRIPTION_PRESETS,
  type ApiTranscriptionSettings,
} from "@/lib/api-transcribe";
import { ModelCard, type ModelCardStatus } from "@/components/model-card";

// ─── Summarization pre-loader ────────────────────────────────────────────────

interface PreloadState {
  status: ModelCardStatus;
  progress: number | null;
  file: string;
}

function useSummarizationPreloader() {
  const [states, setStates] = useState<Record<string, PreloadState>>({});
  const workersRef = useRef<Record<string, Worker>>({});

  const preload = useCallback((modelId: string) => {
    // Don't start a second download for the same model
    if (workersRef.current[modelId]) return;

    setStates((prev) => ({
      ...prev,
      [modelId]: { status: "loading", progress: null, file: "" },
    }));

    const worker = new Worker(
      new URL("../workers/summarize.worker.ts", import.meta.url),
      { type: "module" }
    );
    workersRef.current[modelId] = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string;
        info?: unknown;
        message?: string;
      };

      if (msg.type === "progress") {
        const info = msg.info as {
          status?: string;
          file?: string;
          progress?: number;
        } | undefined;
        if (info?.status === "download") {
          setStates((prev) => ({
            ...prev,
            [modelId]: {
              status: "loading",
              progress: info.progress ?? null,
              file: info.file ?? "",
            },
          }));
        }
      } else if (msg.type === "ready") {
        setStates((prev) => ({
          ...prev,
          [modelId]: { status: "ready", progress: null, file: "" },
        }));
        worker.terminate();
        delete workersRef.current[modelId];
      } else if (msg.type === "error") {
        setStates((prev) => ({
          ...prev,
          [modelId]: { status: "error", progress: null, file: "" },
        }));
        worker.terminate();
        delete workersRef.current[modelId];
      }
    };

    worker.onerror = () => {
      setStates((prev) => ({
        ...prev,
        [modelId]: { status: "error", progress: null, file: "" },
      }));
      worker.terminate();
      delete workersRef.current[modelId];
    };

    worker.postMessage({ type: "load", model: modelId });
  }, []);

  // Terminate all workers on unmount
  useEffect(() => {
    const ref = workersRef.current;
    return () => {
      Object.values(ref).forEach((w) => w.terminate());
    };
  }, []);

  return { states, preload };
}

// ─── Settings page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });

  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");

  const [apiTx, setApiTx] = useState<ApiTranscriptionSettings>(getApiTranscriptionSettings);
  const selectedPreset = API_TRANSCRIPTION_PRESETS.find(
    (p) => p.baseUrl === apiTx.baseUrl && p.model === apiTx.model
  ) ?? API_TRANSCRIPTION_PRESETS[2];

  // Whisper model — controlled from WhisperContext
  const {
    model: activeWhisperModel,
    modelState: whisperState,
    downloadProgress: whisperProgress,
    modelError: whisperError,
    loadModel: loadWhisperModel,
  } = useWhisperContext();

  // Summarization model — controlled locally
  const [activeSumModel, setActiveSumModel] = useState<SummarizationModelId>(
    getStoredSummarizationModel
  );
  const sumPreloader = useSummarizationPreloader();

  useEffect(() => {
    if (settings) {
      setGroqApiKey(settings.groqApiKey || "");
      setGroqModel(settings.groqModel || "llama-3.3-70b-versatile");
    }
  }, [settings]);

  const handleSave = () => {
    setApiTranscriptionSettings(apiTx);
    updateSettings.mutate(
      { data: { groqApiKey, groqModel } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetSettingsQueryKey(), data);
          toast({ title: "Settings saved", description: "Your preferences have been updated." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        }
      }
    );
  };

  const handleSelectSumModel = (id: SummarizationModelId) => {
    setStoredSummarizationModel(id);
    setActiveSumModel(id);
    // Pre-download if not already cached/downloading
    const state = sumPreloader.states[id];
    if (!state || (state.status !== "loading" && state.status !== "ready")) {
      sumPreloader.preload(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Transcription is always local. AI features are optional.</p>
      </div>

      <div className="space-y-6">

        {/* ── Whisper transcription models ── */}
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Transcription Models
            </CardTitle>
            <CardDescription>
              Whisper runs entirely in your browser via WebAssembly — audio never leaves your device.
              Models are downloaded once and cached for offline use. Larger models are more accurate
              but take longer to download.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {WHISPER_MODELS.map((m) => {
              const isActive = activeWhisperModel === m.id;
              return (
                <ModelCard
                  key={m.id}
                  label={m.label}
                  description={m.description}
                  sizeMb={m.sizeMb}
                  isActive={isActive}
                  status={
                    isActive
                      ? whisperState === "loading"
                        ? "loading"
                        : whisperState === "error"
                        ? "error"
                        : "ready"
                      : "idle"
                  }
                  downloadProgress={
                    isActive && whisperProgress
                      ? whisperProgress.progress
                      : null
                  }
                  downloadFile={
                    isActive && whisperProgress ? whisperProgress.file : undefined
                  }
                  error={isActive ? whisperError : null}
                  onSelect={() => loadWhisperModel(m.id as WhisperModelId)}
                  selectLabel="Download & Use"
                />
              );
            })}
          </CardContent>
        </Card>

        {/* ── Summarization models ── */}
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Local Summarization Models
            </CardTitle>
            <CardDescription>
              Summarization runs in your browser — no internet required after the initial download.
              All models produce abstractive summaries; the larger ones handle complex transcripts
              better. Used when you click "Summarize" on a transcript without a Groq API key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {SUMMARIZATION_MODELS.map((m) => {
              const isActive = activeSumModel === m.id;
              const preloadState = sumPreloader.states[m.id];
              return (
                <ModelCard
                  key={m.id}
                  label={m.label}
                  description={m.description}
                  sizeMb={m.sizeMb}
                  isActive={isActive}
                  status={
                    isActive && preloadState
                      ? preloadState.status
                      : isActive
                      ? "idle"
                      : preloadState?.status ?? "idle"
                  }
                  downloadProgress={preloadState?.progress ?? null}
                  downloadFile={preloadState?.file}
                  onSelect={() => handleSelectSumModel(m.id)}
                  selectLabel={
                    preloadState?.status === "ready"
                      ? "Use This Model"
                      : "Download & Use"
                  }
                />
              );
            })}
          </CardContent>
        </Card>

        {/* ── API Transcription ── */}
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                API Transcription — Optional
              </span>
              <Switch
                checked={apiTx.enabled}
                onCheckedChange={(v) => setApiTx((s) => ({ ...s, enabled: v }))}
                aria-label="Enable API transcription"
              />
            </CardTitle>
            <CardDescription>
              Send audio to an OpenAI-compatible transcription endpoint instead of running Whisper locally.
              Works with Groq, OpenAI, or any compatible service. Requires an internet connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select
                value={selectedPreset.label}
                onValueChange={(label) => {
                  const p = API_TRANSCRIPTION_PRESETS.find((x) => x.label === label);
                  if (p) setApiTx((s) => ({ ...s, baseUrl: p.baseUrl, model: p.model }));
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {API_TRANSCRIPTION_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiTxKey" className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                API Key
              </Label>
              <Input
                id="apiTxKey"
                type="password"
                placeholder={selectedPreset.keyHint ?? "API key…"}
                value={apiTx.apiKey}
                onChange={(e) => setApiTx((s) => ({ ...s, apiKey: e.target.value }))}
                className="font-mono bg-background"
              />
              {selectedPreset.keyLink && (
                <a
                  href={selectedPreset.keyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary underline hover:no-underline"
                >
                  Get a key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiTxBase">Base URL</Label>
              <Input
                id="apiTxBase"
                placeholder="https://api.groq.com/openai"
                value={apiTx.baseUrl}
                onChange={(e) => setApiTx((s) => ({ ...s, baseUrl: e.target.value }))}
                className="font-mono bg-background text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Must expose a <code>/v1/audio/transcriptions</code> endpoint (OpenAI format).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiTxModel">Model</Label>
              <Input
                id="apiTxModel"
                placeholder="whisper-large-v3-turbo"
                value={apiTx.model}
                onChange={(e) => setApiTx((s) => ({ ...s, model: e.target.value }))}
                className="font-mono bg-background text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── AI Features (Groq) ── */}
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              AI Features — Optional, Powered by Groq
            </CardTitle>
            <CardDescription>
              Summarization, filler word cleanup, and auto-tagging use Groq's free API.
              Transcription works without this key.{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline hover:no-underline"
              >
                Get a free key at console.groq.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                Groq API Key
              </Label>
              <Input
                id="apiKey"
                data-testid="input-groq-api-key"
                type="password"
                placeholder="gsk_..."
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                className="font-mono bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Stored locally. Only used for summarization, cleanup, and tagging calls to Groq.
              </p>
            </div>

            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={groqModel} onValueChange={setGroqModel}>
                <SelectTrigger className="bg-background" data-testid="select-groq-model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama-3.3-70b-versatile">Llama 3.3 70B — Best quality (recommended)</SelectItem>
                  <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B — Fastest</SelectItem>
                  <SelectItem value="gemma2-9b-it">Gemma 2 9B — Google's model</SelectItem>
                  <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B — Long context</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              data-testid="button-save-settings"
              onClick={handleSave}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>

        {/* ── Storage ── */}
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              Storage
            </CardTitle>
            <CardDescription>
              All transcripts are stored locally — nothing is uploaded to any cloud service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Database Location</Label>
              <Input
                disabled
                value={settings?.storageDir || "Local App Data"}
                className="bg-muted font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
