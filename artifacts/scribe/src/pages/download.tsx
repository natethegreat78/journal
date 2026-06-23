import { Monitor, Smartphone, Apple, Chrome, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePwaInstall } from "@/hooks/use-pwa-install";

function DetectedPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua) && !/Mobile/.test(ua)) return "mac";
  return "other";
}

export function DownloadPage() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const platform = DetectedPlatform();

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Get the App</h1>
        <p className="text-muted-foreground mt-1">
          Use Journal offline, on your desktop or phone — your data stays on your device.
        </p>
      </div>

      {/* PWA Install */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Install as Web App</CardTitle>
              <CardDescription>Works on any device, no app store required</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                ✓ Installed
              </Badge>
              <span>Journal is already installed on this device.</span>
            </div>
          ) : canInstall ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your browser supports one-click installation. Journal will appear in your app launcher and work offline.
              </p>
              <Button onClick={install} className="gap-2">
                <Download className="w-4 h-4" />
                Install Now
              </Button>
            </div>
          ) : platform === "ios" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                To install on iOS:
              </p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button in Safari (the box with an arrow)</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                <li>Tap <strong>Add</strong> — Journal appears on your home screen</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                To install Journal as an app:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Chrome className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>Chrome / Edge:</strong> click the install icon (⊕) in the address bar, or open the browser menu and choose "Install Journal".
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Monitor className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>Other browsers:</strong> use Chrome or Edge for the best install experience.
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mac Desktop App */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Apple className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Mac Desktop App</CardTitle>
              <CardDescription>Native Electron app for Mac Intel — fully local, no cloud</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The Mac app runs a local SQLite server on your machine — no Replit account needed after install.
            Transcription, AI cleanup, and all your data stay on your computer.
          </p>

          <div className="rounded-lg bg-secondary/50 border border-border/50 p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requirements</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• macOS on Intel (x64) — Apple Silicon via Rosetta</li>
              <li>• Chrome or any Chromium browser for recording</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const a = document.createElement("a");
                a.href = "https://github.com/your-org/journal/releases/latest/download/Journal.dmg";
                a.click();
              }}
              disabled
            >
              <Apple className="w-4 h-4" />
              Download .dmg
              <Badge variant="secondary" className="ml-1 text-xs">Coming soon</Badge>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Build it yourself: see{" "}
            <a
              href="https://github.com/your-org/journal#building-the-mac-app"
              className="underline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              BUILDING_MAC_APP.md
            </a>{" "}
            in the repository.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
