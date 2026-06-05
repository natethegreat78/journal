import { useState } from "react";
import { Link } from "wouter";
import { useListTranscripts, useGetTranscriptStats, getGetTranscriptStatsQueryKey, getListTranscriptsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Clock, FileText, Activity, Loader2, Library } from "lucide-react";
import { format } from "date-fns";

export function TranscriptsPage() {
  const [search, setSearch] = useState("");
  
  const { data: stats, isLoading: isStatsLoading } = useGetTranscriptStats({
    query: { queryKey: getGetTranscriptStatsQueryKey() }
  });
  
  const { data: transcripts, isLoading: isTranscriptsLoading } = useListTranscripts(
    { search: search || undefined },
    { query: { queryKey: getListTranscriptsQueryKey({ search: search || undefined }) } }
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Library</h1>
          <p className="text-muted-foreground">All your recorded thoughts and meetings.</p>
        </div>
        <Link href="/">
          <Button>New Recording</Button>
        </Link>
      </div>

      {!isStatsLoading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card/50 shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Transcripts</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Words Spoken</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWords.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Time</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor(stats.totalDurationSeconds / 60)}m {stats.totalDurationSeconds % 60}s
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search transcripts..." 
          className="pl-10 max-w-md bg-card/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isTranscriptsLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : transcripts && transcripts.length > 0 ? (
        <div className="space-y-4">
          {transcripts.map((transcript) => (
            <Link key={transcript.id} href={`/transcripts/${transcript.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-card/50 shadow-sm border-border/50 group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                      {transcript.title || "Untitled"}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(transcript.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-2 font-serif leading-relaxed">
                    {transcript.rawText}
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs font-medium text-muted-foreground">
                    {transcript.durationSeconds ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(transcript.durationSeconds / 60)}:{(transcript.durationSeconds % 60).toString().padStart(2, '0')}
                      </span>
                    ) : null}
                    <span>{transcript.wordCount} words</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed rounded-lg border-border bg-card/20">
          <Library className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">No transcripts found</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {search ? "No results matched your search." : "You haven't recorded anything yet."}
          </p>
          {!search && (
            <Link href="/">
              <Button variant="outline">Start Recording</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
