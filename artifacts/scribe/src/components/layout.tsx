import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Mic, Library, Settings, Moon, Sun, Download, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { useWhisperContext } from "@/context/whisper-context";

function ModelReadinessIndicator() {
  const { modelState, downloadProgress, useApiMode } = useWhisperContext();

  if (useApiMode) return null;

  if (modelState === "loading") {
    const pct = downloadProgress?.progress ?? 0;
    const isDownloading = !!(downloadProgress && downloadProgress.total > 0);
    return (
      <div className="px-3 py-2.5 rounded-md bg-primary/5 border border-primary/10 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
          <span className="truncate">
            {isDownloading ? `Caching model… ${Math.round(pct)}%` : "Preparing offline model…"}
          </span>
        </div>
        {isDownloading && (
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  if (modelState === "ready") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
        <Wifi className="w-3 h-3 text-green-500 shrink-0" />
        <span>Ready to record offline</span>
      </div>
    );
  }

  if (modelState === "error") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-destructive">
        <WifiOff className="w-3 h-3 shrink-0" />
        <span>Offline model unavailable</span>
      </div>
    );
  }

  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { href: "/", label: "Record", icon: Mic },
    { href: "/transcripts", label: "Library", icon: Library },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/download", label: "Get the App", icon: Download },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 flex flex-col bg-card/50 backdrop-blur-sm">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-primary">
            Journal.
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 space-y-2">
          <ModelReadinessIndicator />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="h-full max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
