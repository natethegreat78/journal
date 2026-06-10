import { useLocation } from "wouter";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useWhisper, getStoredModel, WHISPER_MODELS } from "@/hooks/use-whisper";
import { useCreateTranscript } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Mic, Square, Loader2, AlertCircle, RotateCcw, Save,
  Download, FolderOpen, FilePlus, FileText, CheckCircle2, X, BookOpen,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useRef } from "react";
import {
  buildOdtBytes, exportAsOdt,
  appendToOdtBytes, appendToTxt,
} from "@/lib/export-odt";
import {
  buildDocxBytes, exportAsDocx, appendToDocxBytes,
} from "@/lib/export-docx";

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type FileMode = "txt" | "odt" | "docx";

interface TargetFile {
  /** Chrome/Edge real handle; null = Firefox download path */
  handle: FileSystemFileHandle | null;
  /** Firefox only: the File object read at pick-time for appending */
  firefoxFile: File | null;
  name: string;
  mode: FileMode;
  /** true = append entry to existing file; false = create/overwrite */
  append: boolean;
}

const FILE_PICKER_TYPES = [
  { description: "Plain text",         accept: { "text/plain": [".txt"] } },
  { description: "OpenDocument Text",  accept: { "application/vnd.oasis.opendocument.text": [".odt"] } },
  { description: "Word Document",      accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] } },
];

function transcriptTitle(text: string) {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "");
}

async function readHandle(handle: FileSystemFileHandle): Promise<Uint8Array> {
  const file = await handle.getFile();
  const ab = await file.arrayBuffer();
  console.log("[scribe] readHandle:", handle.name, "size=", ab.byteLength);
  return new Uint8Array(ab);
}

async function writeToHandle(
  handle: FileSystemFileHandle,
  data: string | Uint8Array,
): Promise<void> {
  // Explicitly request write permission — required if opened without mode:'readwrite'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = handle as any;
  if (typeof h.requestPermission === "function") {
    const perm = await h.requestPermission({ mode: "readwrite" });
    console.log("[scribe] writeToHandle permission:", perm);
    if (perm !== "granted") throw new Error("Write permission was not granted");
  }
  const size = typeof data === "string" ? data.length : data.byteLength;
  console.log("[scribe] writeToHandle:", handle.name, "bytes=", size);
  const writable = await handle.createWritable();
  // Slice to an owned ArrayBuffer so the write gets exactly the right bytes
  await writable.write(
    typeof data === "string"
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  );
  await writable.close();
  console.log("[scribe] writeToHandle: done");
}

function triggerDownload(filename: string, data: string | Uint8Array, mime: string) {
  const blob = typeof data === "string"
    ? new Blob([data], { type: mime })
    : new Blob([data.buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function RecorderPage() {
  const [model] = useState(getStoredModel);
  const { modelState, downloadProgress, modelError, transcribe } = useWhisper(model);
  const { state, duration, transcript, error, start, stop, reset } = useMediaRecorder(transcribe);
  const [, setLocation] = useLocation();
  const createTranscript = useCreateTranscript();

  const [targetFile, setTargetFile] = useState<TargetFile | null>(null);
  const [fileSaveState, setFileSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingModeRef = useRef<FileMode | null>(null);

  const hasFsApi = "showSaveFilePicker" in window && "showOpenFilePicker" in window;

  const clearTarget = useCallback(() => {
    setTargetFile(null);
    setFileSaveState("idle");
    setFileSaveError(null);
  }, []);

  // ── Chrome: new file ──────────────────────────────────────────────────────
  const pickNewFileAndRecord = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
        types: FILE_PICKER_TYPES,
        suggestedName: "journal-entry",
      });
      const mode: FileMode = handle.name.toLowerCase().endsWith(".odt") ? "odt" : "txt";
      setTargetFile({ handle, firefoxFile: null, name: handle.name, mode, append: false });
      setFileSaveState("idle");
      setFileSaveError(null);
      await start();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }, [start]);

  // ── Chrome: open existing journal file ───────────────────────────────────
  const openJournalAndRecord = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [handle]: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
        types: FILE_PICKER_TYPES,
        multiple: false,
        mode: "readwrite",       // request write permission upfront
      });
      const mode: FileMode = handle.name.toLowerCase().endsWith(".odt") ? "odt" : "txt";
      setTargetFile({ handle, firefoxFile: null, name: handle.name, mode, append: true });
      setFileSaveState("idle");
      setFileSaveError(null);
      // Don't auto-start — let the user click the mic when ready
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }, []);

  // ── Firefox: new download ─────────────────────────────────────────────────
  const recordForDownload = useCallback(async (mode: FileMode) => {
    setTargetFile({ handle: null, firefoxFile: null, name: `journal-entry.${mode}`, mode, append: false });
    setFileSaveState("idle");
    setFileSaveError(null);
    await start();
  }, [start]);

  // ── Firefox: open existing file via <input> ───────────────────────────────
  const openJournalFirefox = useCallback((mode: FileMode) => {
    pendingModeRef.current = mode;
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";                          // reset so same file can be re-opened
    const mode = pendingModeRef.current ?? (file.name.toLowerCase().endsWith(".odt") ? "odt" : "txt");
    setTargetFile({ handle: null, firefoxFile: file, name: file.name, mode, append: true });
    setFileSaveState("idle");
    setFileSaveError(null);
    // Don't auto-start — let the user click the mic when ready
  }, []);

  // ── Save / append after transcription ────────────────────────────────────
  const handleSaveToFile = useCallback(async () => {
    if (!targetFile || !transcript.trim()) return;
    setFileSaveState("saving");
    const title = transcriptTitle(transcript);
    const now   = new Date().toLocaleString();

    try {
      const { handle, firefoxFile, mode, append } = targetFile;
      const slug = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      console.log("[scribe] handleSaveToFile:", { name: targetFile.name, mode, append, hasHandle: !!handle, hasFirefoxFile: !!firefoxFile });

      if (append) {
        if (mode === "odt") {
          const existingBytes = handle
            ? await readHandle(handle)
            : new Uint8Array(await (firefoxFile as File).arrayBuffer());
          const updated = appendToOdtBytes(existingBytes, transcript.trim(), now);
          if (handle) await writeToHandle(handle, updated);
          else triggerDownload(targetFile.name, updated, "application/vnd.oasis.opendocument.text");
        } else if (mode === "docx") {
          const existingBytes = handle
            ? await readHandle(handle)
            : new Uint8Array(await (firefoxFile as File).arrayBuffer());
          const updated = appendToDocxBytes(existingBytes, transcript.trim(), now);
          if (handle) await writeToHandle(handle, updated);
          else triggerDownload(targetFile.name, updated, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        } else {
          const existingText = handle
            ? new TextDecoder().decode(await readHandle(handle))
            : await (firefoxFile as File).text();
          const updated = appendToTxt(existingText, transcript.trim(), now);
          if (handle) await writeToHandle(handle, updated);
          else triggerDownload(targetFile.name, updated, "text/plain");
        }
      } else {
        // create / overwrite
        if (mode === "odt") {
          const bytes = buildOdtBytes(title, transcript.trim(), null, now);
          if (handle) await writeToHandle(handle, bytes);
          else exportAsOdt(title, transcript.trim(), null, now);
        } else if (mode === "docx") {
          const bytes = buildDocxBytes(title, transcript.trim(), null, now);
          if (handle) await writeToHandle(handle, bytes);
          else exportAsDocx(title, transcript.trim(), null, now);
        } else {
          const content = `${title}\n${now}\n\n${transcript.trim()}`;
          if (handle) await writeToHandle(handle, content);
          else triggerDownload(`${slug}.txt`, content, "text/plain");
        }
      }

      setFileSaveState("saved");
    } catch (err) {
      setFileSaveError(err instanceof Error ? err.message : String(err));
      setFileSaveState("error");
    }
  }, [targetFile, transcript]);

  const handleSaveToLibrary = () => {
    if (!transcript.trim()) return;
    const title = transcriptTitle(transcript);
    createTranscript.mutate(
      { data: { title, rawText: transcript, durationSeconds: duration } },
      { onSuccess: (data) => setLocation(`/transcripts/${data.id}`) }
    );
  };

  const wordCount  = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
  const modelLabel = WHISPER_MODELS.find(m => m.id === model)?.label ?? model;
  const isModelReady = modelState === "ready";

  const fileBadgeLabel = targetFile
    ? `${targetFile.append ? "Appending to" : "→"} ${targetFile.name}`
    : null;

  const fileSaveBtnLabel = targetFile
    ? targetFile.handle
      ? targetFile.append ? `Append to ${targetFile.name}` : `Save to ${targetFile.name}`
      : targetFile.append ? `Download updated ${targetFile.name}` : `Download as .${targetFile.mode.toUpperCase()}`
    : "";

  return (
    <div className="flex flex-col h-full py-12 px-8">
      {/* Hidden file input for Firefox append */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.odt"
        className="hidden"
        onChange={onFileInputChange}
      />

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-3">
          What&apos;s on your mind?
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {state === "idle"        && modelState === "loading" && "Loading local Whisper model…"}
          {state === "idle"        && modelState === "ready"   && "Press record and start speaking. Everything stays on this device."}
          {state === "idle"        && modelState === "error"   && "Could not load transcription model."}
          {state === "recording"   && "Recording — speak naturally. Your audio stays on this device."}
          {state === "transcribing"&& "Transcribing locally with Whisper…"}
          {state === "done"        && "Transcription complete. Save to your library or write to a file."}
          {state === "error"       && "Something went wrong."}
        </p>
      </div>

      <AnimatePresence>
        {modelState === "loading" && state === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mb-6 max-w-2xl mx-auto w-full"
          >
            <Card className="p-5 bg-card/50 border-border/50 shadow-sm">
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">Loading Whisper model</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {modelLabel} — downloading and caching locally for offline use
                  </p>
                  {downloadProgress && downloadProgress.total > 0 ? (
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${downloadProgress.progress}%` }}
                          transition={{ ease: "linear" }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(downloadProgress.progress)}% — {downloadProgress.file}
                      </p>
                    </div>
                  ) : (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/60 rounded-full"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        style={{ width: "40%" }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {modelState === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 max-w-2xl mx-auto w-full"
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Could not load model: {modelError}. Try refreshing.</AlertDescription>
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

          {/* ── IDLE ── */}
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center gap-5"
            >
              <button
                data-testid="button-record"
                onClick={start}
                disabled={!isModelReady}
                className="w-32 h-32 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {modelState === "loading"
                  ? <Loader2 className="w-10 h-10 animate-spin" />
                  : <Mic className="w-12 h-12" />
                }
              </button>

              {isModelReady && (
                <p className="text-xs text-muted-foreground">
                  Transcription runs locally · no internet required
                </p>
              )}

              {/* ── File options (shown once model ready) ── */}
              {isModelReady && (
                <div className="flex flex-col items-center gap-3 mt-1">

                  {/* Selected file badge */}
                  {targetFile && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
                      {targetFile.append
                        ? <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        : <FileText className="w-3.5 h-3.5 shrink-0" />
                      }
                      <span className="max-w-[220px] truncate font-medium">{fileBadgeLabel}</span>
                      <button onClick={clearTarget} aria-label="Clear" className="ml-0.5 text-primary/60 hover:text-primary transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {hasFsApi ? (
                    /* Chrome / Edge */
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onClick={pickNewFileAndRecord}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                      >
                        <FilePlus className="w-3.5 h-3.5" />
                        Record to a new file (.txt or .odt)…
                      </button>
                      <button
                        onClick={openJournalAndRecord}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Add entry to an existing journal file…
                      </button>
                    </div>
                  ) : (
                    /* Firefox */
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-muted-foreground">Record and save as a new file:</p>
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        {(["txt", "odt", "docx"] as const).map(fmt => (
                          <button key={fmt}
                            onClick={() => recordForDownload(fmt)}
                            className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
                          >
                            <FilePlus className="w-3 h-3" /> .{fmt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Or add an entry to an existing journal:</p>
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        {(["txt", "odt", "docx"] as const).map(fmt => (
                          <button key={fmt}
                            onClick={() => openJournalFirefox(fmt)}
                            className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
                          >
                            <BookOpen className="w-3 h-3" /> Open .{fmt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── RECORDING ── */}
          {state === "recording" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
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
                    {targetFile && (
                      <span className="flex items-center gap-1 text-primary/70">
                        {targetFile.append ? <BookOpen className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        {fileBadgeLabel}
                      </span>
                    )}
                  </div>
                  <Button data-testid="button-stop" onClick={stop} variant="destructive" className="gap-2">
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

          {/* ── TRANSCRIBING ── */}
          {state === "transcribing" && (
            <motion.div
              key="transcribing"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6"
            >
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">
                Transcribing locally with Whisper — audio never leaves your device
              </p>
            </motion.div>
          )}

          {/* ── DONE ── */}
          {state === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="w-full flex-1 flex flex-col"
            >
              <Card className="w-full flex-1 flex flex-col overflow-hidden bg-card/50 backdrop-blur shadow-sm border-border/50">
                {/* ── Toolbar ── */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                    <span>{formatDuration(duration)}</span>
                    <span>{wordCount} words</span>
                    {duration < 3 && (
                      <span className="text-amber-500 text-xs">Recording was very short — transcription may be inaccurate</span>
                    )}
                  </div>
                  <Button
                    data-testid="button-discard"
                    variant="ghost" size="sm"
                    onClick={() => { reset(); clearTarget(); }}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Discard
                  </Button>
                </div>

                {/* ── Error banner ── */}
                {fileSaveState === "error" && fileSaveError && (
                  <div className="px-6 py-2 border-b border-destructive/20 bg-destructive/5">
                    <p className="text-xs text-destructive">{fileSaveError}</p>
                  </div>
                )}

                {/* ── Transcript ── */}
                <div className="flex-1 p-8 overflow-y-auto font-serif text-xl leading-relaxed text-foreground">
                  {transcript}
                </div>

                {/* ── Save actions — file-append is primary when a file is targeted ── */}
                <div className="border-t border-border/50 bg-muted/10 px-6 py-4 flex flex-col gap-3">
                  {targetFile ? (
                    <>
                      {/* Primary: save to file */}
                      {fileSaveState === "saved" ? (
                        <div className="flex items-center justify-center gap-2 text-green-600 font-medium py-2">
                          <CheckCircle2 className="w-5 h-5" />
                          {targetFile.handle ? `Saved to ${targetFile.name}` : "Downloaded"}
                        </div>
                      ) : (
                        <Button
                          size="lg"
                          onClick={handleSaveToFile}
                          disabled={fileSaveState === "saving"}
                          className="w-full gap-2 text-base"
                        >
                          {fileSaveState === "saving"
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : targetFile.append
                              ? <BookOpen className="w-5 h-5" />
                              : targetFile.handle
                                ? <FileText className="w-5 h-5" />
                                : <Download className="w-5 h-5" />
                          }
                          {fileSaveBtnLabel}
                        </Button>
                      )}

                      {/* Secondary: save to library */}
                      <button
                        data-testid="button-save"
                        onClick={handleSaveToLibrary}
                        disabled={createTranscript.isPending}
                        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 disabled:opacity-40"
                      >
                        {createTranscript.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Save className="w-3.5 h-3.5" />
                        }
                        Also save to library
                      </button>
                    </>
                  ) : (
                    /* No file targeted — library is the only action */
                    <Button
                      data-testid="button-save"
                      size="lg"
                      onClick={handleSaveToLibrary}
                      disabled={createTranscript.isPending}
                      className="w-full gap-2 text-base"
                    >
                      {createTranscript.isPending
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <Save className="w-5 h-5" />
                      }
                      Save to Library
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center"
            >
              <Button variant="outline" onClick={() => { reset(); clearTarget(); }} className="gap-2">
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
