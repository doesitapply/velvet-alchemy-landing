/**
 * AI Provider Management Page
 * 
 * Admin UI for managing AI providers, API keys, and monitoring health/costs
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, DollarSign, Activity, Clock } from "lucide-react";
import { toast } from "sonner";

export default function AIProviders() {
  const [editingProvider, setEditingProvider] = useState<number | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const { data: providers, isLoading, refetch } = trpc.provider.list.useQuery();
  const { data: costSummary } = trpc.provider.getCostSummary.useQuery();
  const updateProvider = trpc.provider.update.useMutation({
    onSuccess: () => {
      toast.success("Provider updated successfully");
      refetch();
      setEditingProvider(null);
      setApiKeyInput("");
    },
    onError: (error) => {
      toast.error(`Failed to update provider: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const getHealthBadge = (status?: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Degraded</Badge>;
      case "down":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Down</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-serif italic text-gold mb-2">AI Provider Management</h1>
        <p className="text-muted-foreground">
          Manage AI providers, API keys, and monitor costs. Automatic failover ensures 100% uptime.
        </p>
      </div>

      {/* Cost Summary */}
      {costSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gold" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                ${((costSummary.daily.totalCost || 0) / 100).toFixed(4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {costSummary.daily.totalRequests || 0} requests
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Activity className="h-4 w-4 text-gold" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                ${((costSummary.weekly.totalCost || 0) / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {costSummary.weekly.totalRequests || 0} requests
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold">
                ${((costSummary.monthly.totalCost || 0) / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {costSummary.monthly.totalRequests || 0} requests
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider List */}
      <div className="space-y-4">
        <h2 className="text-xl font-serif italic text-gold">Providers</h2>
        {providers?.filter(p => p.name !== 'manus').map((provider: any) => (
          <Card key={provider.id} className="bg-card/50 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                  {getHealthBadge(provider.health?.status)}
                  {provider.hasApiKey && (
                    <Badge variant="outline" className="text-xs">API Key Configured</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enabled-${provider.id}`} className="text-sm">Enabled</Label>
                    <Switch
                      id={`enabled-${provider.id}`}
                      checked={provider.isEnabled}
                      onCheckedChange={(checked) => {
                        updateProvider.mutate({
                          id: provider.id,
                          isEnabled: checked,
                        });
                      }}
                    />
                  </div>
                  <Badge variant="secondary">Priority: {provider.priority}</Badge>
                </div>
              </div>
              <CardDescription>
                Cost: ${((provider.costPer1kTokens || 0) / 100).toFixed(4)} per 1K tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              {provider.health && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-mono text-gold">
                      {provider.health.successRate ? `${(provider.health.successRate / 100).toFixed(2)}%` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Latency</p>
                    <p className="font-mono text-gold">
                      {provider.health.avgLatencyMs ? `${provider.health.avgLatencyMs}ms` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Consecutive Failures</p>
                    <p className="font-mono text-gold">{provider.health.consecutiveFailures || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Success</p>
                    <p className="font-mono text-gold text-xs">
                      {provider.health.lastSuccessAt
                        ? new Date(provider.health.lastSuccessAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              )}

              {/* API Key Management */}
              <div className="space-y-2">
                {editingProvider === provider.id ? (
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Enter API key..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        updateProvider.mutate({
                          id: provider.id,
                          apiKey: apiKeyInput,
                        });
                      }}
                      disabled={!apiKeyInput || updateProvider.isPending}
                    >
                      {updateProvider.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingProvider(null);
                        setApiKeyInput("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingProvider(provider.id)}
                  >
                    {provider.hasApiKey ? "Update API Key" : "Add API Key"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-card/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Automatic Failover:</strong> If a provider hits rate limits or fails, the system automatically switches to the next available provider.
          </p>
          <p>
            • <strong>Priority Order:</strong> Providers are tried in priority order (lower number = higher priority).
          </p>
          <p>
            • <strong>Health Monitoring:</strong> Each provider's health is tracked based on success rate, latency, and consecutive failures.
          </p>
          <p>
            • <strong>Cost Tracking:</strong> All API usage is logged with token counts and costs for budget monitoring.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
