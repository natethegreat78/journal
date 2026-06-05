import { useGetSettings, getGetSettingsQueryKey, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, HardDrive, Cpu, Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });
  
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        openaiApiKey: settings.openaiApiKey || "",
        openaiModel: settings.openaiModel || "gpt-4o-mini",
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetSettingsQueryKey(), data);
          toast({
            title: "Settings saved",
            description: "Your preferences have been updated.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save settings.",
            variant: "destructive"
          });
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
        <p className="text-muted-foreground">Configure your AI models and local storage.</p>
      </div>

      <div className="space-y-6">
        <Card className="bg-card/50 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              AI Features
            </CardTitle>
            <CardDescription>
              Configure OpenAI to enable summarization, filler word cleanup, and auto-tagging.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                OpenAI API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={formData.openaiApiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                className="font-mono bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally on your machine.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select 
                value={formData.openaiModel} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, openaiModel: val }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster, cheaper)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (Higher quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save AI Settings
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
              Your data is stored locally in an SQLite database.
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
