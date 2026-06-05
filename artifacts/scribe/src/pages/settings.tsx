import { useGetSettings, getGetSettingsQueryKey, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, HardDrive, Cpu, Loader2, Save, ExternalLink, Mic } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { WHISPER_MODELS, getStoredModel, setStoredModel, type WhisperModelId } from "@/hooks/use-whisper";

export function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });

  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [whisperModel, setWhisperModel] = useState<WhisperModelId>(getStoredModel);

  useEffect(() => {
    if (settings) {
      setGroqApiKey(settings.groqApiKey || "");
      setGroqModel(settings.groqModel || "llama-3.3-70b-versatile");
    }
  }, [settings]);

  const handleSave = () => {
    setStoredModel(whisperModel);
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
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Transcription — Runs Locally
            </CardTitle>
            <CardDescription>
              Whisper runs entirely in your browser using WebAssembly. Audio never leaves your device.
              The model is downloaded once and cached for offline use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Whisper Model</Label>
              <Select
                value={whisperModel}
                onValueChange={(val) => setWhisperModel(val as WhisperModelId)}
              >
                <SelectTrigger className="bg-background" data-testid="select-whisper-model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {WHISPER_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changing the model triggers a one-time download. All models are then cached in your browser.
              </p>
            </div>
          </CardContent>
        </Card>

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
