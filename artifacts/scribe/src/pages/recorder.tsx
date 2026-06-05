import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useCreateTranscript } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecorderPage() {
  const { isRecording, interimResult, finalResult, error, startRecording, stopRecording } = useSpeechRecognition();
  const [duration, setDuration] = useState(0);
  const [, setLocation] = useLocation();
  
  const createTranscript = useCreateTranscript();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStopAndSave = () => {
    stopRecording();
    
    const text = (finalResult + interimResult).trim();
    if (!text) return;

    // Generate title from first 6 words
    const words = text.split(/\s+/);
    const title = words.slice(0, 6).join(" ") + (words.length > 6 ? "..." : "");

    createTranscript.mutate({
      data: {
        title: title || "Untitled Transcript",
        rawText: text,
        durationSeconds: duration
      }
    }, {
      onSuccess: (data) => {
        setLocation(`/transcripts/${data.id}`);
      }
    });
  };

  const wordCount = (finalResult + interimResult).trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="flex flex-col h-full py-12 px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
          What's on your mind?
        </h1>
        <p className="text-muted-foreground">
          Press record and start speaking. Your thoughts will be transcribed locally.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-8 max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 flex flex-col items-center max-w-3xl mx-auto w-full">
        {!isRecording && !finalResult && !interimResult && (
          <div className="flex-1 flex items-center justify-center w-full">
            <button
              onClick={() => { setDuration(0); startRecording(); }}
              className="w-32 h-32 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95"
              disabled={!!error || createTranscript.isPending}
            >
              <Mic className="w-12 h-12" />
            </button>
          </div>
        )}

        {(isRecording || finalResult || interimResult) && (
          <Card className="w-full flex-1 flex flex-col overflow-hidden bg-card/50 backdrop-blur shadow-sm border-border/50">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-destructive animate-pulse' : 'bg-muted'}`} />
                  {formatDuration(duration)}
                </div>
                <div>{wordCount} words</div>
              </div>
              
              {isRecording ? (
                <Button 
                  onClick={handleStopAndSave} 
                  variant="destructive"
                  className="gap-2"
                  disabled={createTranscript.isPending}
                >
                  {createTranscript.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
                  Stop & Save
                </Button>
              ) : (
                <Button onClick={() => { setDuration(0); startRecording(); }} className="gap-2">
                  <Mic className="w-4 h-4" />
                  Resume
                </Button>
              )}
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto font-serif text-xl leading-relaxed">
              <span className="text-foreground">{finalResult}</span>
              {interimResult && (
                <span className="text-muted-foreground ml-1">{interimResult}</span>
              )}
              {isRecording && <span className="inline-block w-2 h-5 ml-1 bg-primary animate-pulse" />}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
