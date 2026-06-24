import { CheckCircle2, Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ModelCardStatus = "idle" | "loading" | "ready" | "error";

interface ModelCardProps {
  label: string;
  description: string;
  sizeMb: number;
  isActive: boolean;
  status?: ModelCardStatus;
  downloadProgress?: number | null;
  downloadFile?: string;
  error?: string | null;
  onSelect: () => void;
  selectLabel?: string;
  disabled?: boolean;
}

export function ModelCard({
  label,
  description,
  sizeMb,
  isActive,
  status = "idle",
  downloadProgress,
  downloadFile,
  error,
  onSelect,
  selectLabel = "Download & Use",
  disabled = false,
}: ModelCardProps) {
  const isLoading = status === "loading";
  const isReady = status === "ready";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        isActive
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-background/60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-medium text-sm">{label}</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              ~{sizeMb} MB
            </Badge>
            {isActive && (
              <Badge className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground">
                Active
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>

        <div className="shrink-0 pt-0.5">
          {(isActive && isReady) || (isActive && status === "idle") ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : isActive && isLoading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : isActive && status === "error" ? (
            <AlertCircle className="w-5 h-5 text-destructive" />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onSelect}
              disabled={disabled || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Download className="w-3 h-3 mr-1" />
              )}
              {isLoading ? "Downloading…" : selectLabel}
            </Button>
          )}
        </div>
      </div>

      {isActive && isLoading && (
        <div className="mt-3 space-y-1">
          <Progress
            value={downloadProgress ?? 0}
            className="h-1.5"
          />
          <p className="text-[10px] text-muted-foreground truncate">
            {downloadFile
              ? `Downloading ${downloadFile.split("/").pop() ?? downloadFile}…`
              : "Preparing model…"}
            {downloadProgress != null && downloadProgress > 0
              ? ` ${Math.round(downloadProgress)}%`
              : ""}
          </p>
        </div>
      )}

      {isActive && status === "error" && error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
