import { useLocation } from "wouter";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useCreateTranscript, useGetSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Loader2, AlertCircle, RotateCcw, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecorderPage() {
  const { state, duration, transcript, error, start, stop, reset } = useMediaRecorder();
  const [, setLocation] = useLocation();
  const createTranscript = useCreateTranscript();

  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const hasApiKey = !!(settings?.groqApiKey && settings.groqApiKey !== "");

  const handleSave = () => {
    if (!transcript.trim()) return;
    const words = transcript.trim().split(/\s+/);
    const title = words.slice(0, 6).join(" ") + (words.length > 6 ? "..." : "");
    createTranscript.mutate(
      { data: { title, rawText: transcript, durationSeconds: duration } },
      {
        onSuccess: (data) => {
          setLocation(`/transcripts/${data.id}`);
        },
      }
    );
  };

  const wordCount = transcript.trim().split(/\s+/).filter((w) => w.length > 0).length;

  return (
    <div className="flex flex-col h-full py-12 px-8">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-3">
          What&apos;s on your mind?
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {state === "idle" && "Press record and start speaking. Your audio is captured locally."}
          {state === "recording" && "Recording — speak naturally. Your audio stays on this device."}
          {state === "transcribing" && "Transcribing with OpenAI Whisper..."}
          {state === "done" && "Transcription complete. Review and save."}
          {state === "error" && "Something went wrong."}
        </p>
      </div>

      <AnimatePresence>
        {!hasApiKey && state === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 max-w-2xl mx-auto w-full"
          >
            <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                An OpenAI API key is required to transcribe recordings. Add one in{" "}
                <button
                  onClick={() => setLocation("/settings")}
                  className="underline font-medium hover:no-underline"
                >
                  Settings
                </button>
                .
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mb-6 max-w-2xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center max-w-3xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex items-center justify-center"
            >
              <button
                data-testid="button-record"
                onClick={start}
                disabled={!hasApiKey}
                className="w-32 h-32 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Mic className="w-12 h-12" />
              </button>
            </motion.div>
          )}

          {state === "recording" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex-1 flex flex-col"
            >
              <Card className="w-full flex-1 flex flex-col overflow-hidden bg-card/50 backdrop-blur shadow-sm border-border/50">
                <div className="flex justify-between items-center px-6 py-4 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                      </span>
                      <span data-testid="text-duration">{formatDuration(duration)}</span>
                    </div>
                    <span>Recording audio locally</span>
                  </div>
                  <Button
                    data-testid="button-stop"
                    onClick={stop}
                    variant="destructive"
                    className="gap-2"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop
                  </Button>
                </div>
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="flex items-end gap-1 h-16">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 rounded-full bg-primary/60"
                        animate={{ height: [`${8 + Math.random() * 40}px`, `${8 + Math.random() * 56}px`] }}
                        transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: i * 0.04 }}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {state === "transcribing" && (
            <motion.div
              key="transcribing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6"
            >
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">
                Sending audio to OpenAI Whisper for transcription...
              </p>
            </motion.div>
          )}

          {state === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex-1 flex flex-col"
            >
              <Card className="w-full flex-1 flex flex-col overflow-hidden bg-card/50 backdrop-blur shadow-sm border-border/50">
                <div className="flex justify-between items-center px-6 py-4 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                    <span>{formatDuration(duration)}</span>
                    <span>{wordCount} words</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      data-testid="button-discard"
                      variant="ghost"
                      size="sm"
                      onClick={reset}
                      className="gap-1.5 text-muted-foreground"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Discard
                    </Button>
                    <Button
                      data-testid="button-save"
                      onClick={handleSave}
                      disabled={createTranscript.isPending}
                      className="gap-2"
                    >
                      {createTranscript.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Transcript
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto font-serif text-xl leading-relaxed text-foreground">
                  {transcript}
                </div>
              </Card>
            </motion.div>
          )}

          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center"
            >
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Try again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
