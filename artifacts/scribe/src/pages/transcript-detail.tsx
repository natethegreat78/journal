import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTranscript, 
  getGetTranscriptQueryKey,
  useUpdateTranscript,
  useDeleteTranscript,
  useSummarizeTranscript,
  useCleanupTranscript,
  useAutotagTranscript,
  useGetSettings,
  getGetSettingsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Download, Trash2, Wand2, Scissors, 
  Tags as TagsIcon, Loader2, Clock, Check, Cpu
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { localSummarize } from "@/lib/local-summarize";

export function TranscriptDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transcript, isLoading } = useGetTranscript(id, {
    query: { enabled: !!id, queryKey: getGetTranscriptQueryKey(id) }
  });

  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });
  const hasApiKey = !!settings?.groqApiKey;

  const updateTranscript = useUpdateTranscript();
  const deleteTranscript = useDeleteTranscript();
  const summarize = useSummarizeTranscript();
  const cleanup = useCleanupTranscript();
  const autotag = useAutotagTranscript();

  const [title, setTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [localSummarizing, setLocalSummarizing] = useState(false);

  useEffect(() => {
    if (transcript && !title) {
      setTitle(transcript.title || "Untitled");
    }
  }, [transcript]);

  const handleTitleBlur = () => {
    if (transcript && title !== transcript.title) {
      updateTranscript.mutate({
        id,
        data: { title }
      }, {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetTranscriptQueryKey(id), data);
        }
      });
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this transcript?")) {
      deleteTranscript.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Transcript deleted" });
          setLocation("/transcripts");
        }
      });
    }
  };

  const handleExport = (format: 'txt' | 'md') => {
    if (!transcript) return;
    const content = format === 'md' 
      ? `# ${transcript.title}\n\n${transcript.summary ? `## Summary\n${transcript.summary}\n\n` : ''}## Transcript\n${transcript.cleanedText || transcript.rawText}`
      : `${transcript.title}\n\n${transcript.summary ? `Summary:\n${transcript.summary}\n\n` : ''}Transcript:\n${transcript.cleanedText || transcript.rawText}`;
      
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcript.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const wrapAIMutation = (mutation: any, actionName: string) => {
    mutation.mutate({ id }, {
      onSuccess: (data: any) => {
        queryClient.setQueryData(getGetTranscriptQueryKey(id), data);
        toast({ title: `${actionName} complete` });
      },
      onError: () => {
        toast({ title: `${actionName} failed`, variant: "destructive" });
      }
    });
  };

  const handleSummarize = () => {
    if (hasApiKey) {
      wrapAIMutation(summarize, "Summary");
      return;
    }
    if (!transcript) return;
    setLocalSummarizing(true);
    const text = transcript.cleanedText ?? transcript.rawText;
    const summary = localSummarize(text);
    updateTranscript.mutate(
      { id, data: { summary } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetTranscriptQueryKey(id), data);
          toast({ title: "Local summary generated" });
        },
        onError: () => {
          toast({ title: "Could not save summary", variant: "destructive" });
        },
        onSettled: () => setLocalSummarizing(false),
      }
    );
  };

  if (isLoading || !transcript) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/transcripts")} className="text-muted-foreground -ml-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('txt')}>
            <Download className="w-4 h-4 mr-2" />
            .TXT
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('md')}>
            <Download className="w-4 h-4 mr-2" />
            .MD
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <Input
          ref={titleInputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="text-4xl font-serif font-bold bg-transparent border-none px-0 h-auto focus-visible:ring-0 rounded-none w-full"
        />
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span>{format(new Date(transcript.createdAt), "MMMM d, yyyy • h:mm a")}</span>
          {transcript.durationSeconds ? (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {Math.floor(transcript.durationSeconds / 60)}:{(transcript.durationSeconds % 60).toString().padStart(2, '0')}
            </span>
          ) : null}
          <span>{transcript.wordCount} words</span>
        </div>
      </div>

      {transcript.tags && transcript.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {transcript.tags.map(tag => (
            <span key={tag.id} className="px-2 py-1 rounded text-xs font-medium border" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-8 bg-card/50 p-2 rounded-lg border border-border/50 shadow-sm w-max">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              disabled={summarize.isPending || localSummarizing}
              onClick={handleSummarize}
            >
              {(summarize.isPending || localSummarizing) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasApiKey ? (
                <Wand2 className="w-4 h-4 text-primary" />
              ) : (
                <Cpu className="w-4 h-4 text-primary" />
              )}
              Summarize
            </Button>
          </TooltipTrigger>
          {!hasApiKey && (
            <TooltipContent>Extractive summary — runs locally, no API key needed</TooltipContent>
          )}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              disabled={!hasApiKey || cleanup.isPending || !!transcript.cleanedText}
              onClick={() => wrapAIMutation(cleanup, "Cleanup")}
            >
              {cleanup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : transcript.cleanedText ? <Check className="w-4 h-4 text-green-500" /> : <Scissors className="w-4 h-4 text-primary" />}
              Clean Filler Words
            </Button>
          </TooltipTrigger>
          {!hasApiKey && <TooltipContent>Requires OpenAI API Key in Settings</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              disabled={!hasApiKey || autotag.isPending}
              onClick={() => wrapAIMutation(autotag, "Auto-tagging")}
            >
              {autotag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TagsIcon className="w-4 h-4 text-primary" />}
              Auto-Tag
            </Button>
          </TooltipTrigger>
          {!hasApiKey && <TooltipContent>Requires OpenAI API Key in Settings</TooltipContent>}
        </Tooltip>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto pb-12">
        {transcript.summary && (
          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold tracking-wider uppercase text-primary">Summary</h3>
                {!hasApiKey && (
                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-border/60 py-0">
                    <Cpu className="w-3 h-3" />
                    local
                  </Badge>
                )}
              </div>
              <p className="text-foreground leading-relaxed">{transcript.summary}</p>
            </div>
          </Card>
        )}

        <div>
          <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground mb-4">Transcript</h3>
          <div className="font-serif text-lg leading-relaxed text-foreground whitespace-pre-wrap">
            {transcript.cleanedText || transcript.rawText}
          </div>
        </div>
      </div>
    </div>
  );
}
