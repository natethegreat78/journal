import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { RecorderPage } from "@/pages/recorder";
import { TranscriptsPage } from "@/pages/transcripts";
import { TranscriptDetailPage } from "@/pages/transcript-detail";
import { SettingsPage } from "@/pages/settings";
import { DownloadPage } from "@/pages/download";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={RecorderPage} />
        <Route path="/transcripts" component={TranscriptsPage} />
        <Route path="/transcripts/:id" component={TranscriptDetailPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/download" component={DownloadPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
