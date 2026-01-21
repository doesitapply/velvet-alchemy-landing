import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, AlertTriangle, Activity, FileText } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function GovernorDashboard() {
  const { user, loading: authLoading } = useAuth();

  // Fetch system config
  const { data: config, isLoading: configLoading, refetch: refetchConfig } = trpc.governor.getConfig.useQuery();
  
  // Fetch rate limit stats
  const { data: rateLimitStats, isLoading: statsLoading } = trpc.governor.getRateLimitStats.useQuery();
  
  // Fetch recent audit logs
  const { data: auditLogs, isLoading: logsLoading } = trpc.governor.getAuditLogs.useQuery({ limit: 20 });

  // Toggle kill-switch mutation
  const toggleKillSwitch = trpc.governor.toggleKillSwitch.useMutation({
    onSuccess: () => {
      toast.success("Kill-switch toggled successfully");
      refetchConfig();
    },
    onError: (error: any) => {
      toast.error(`Failed to toggle kill-switch: ${error.message}`);
    },
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">You do not have permission to access the Governor dashboard.</p>
            <Link href="/command-center">
              <Button>Return to Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isLoading = configLoading || statsLoading || logsLoading;
  const globalKillSwitch = config?.find((c: any) => c.key === "global_kill_switch")?.value === "true";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-serif italic">The Governor</h1>
              <p className="text-sm text-muted-foreground">System Safety & Compliance</p>
            </div>
          </div>
          <Link href="/command-center">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>

        {/* Kill-Switch Control */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Global Kill-Switch
              </h2>
              <p className="text-sm text-muted-foreground">
                Immediately disable all system operations for maintenance or emergency.
              </p>
            </div>
            <Button
              variant={globalKillSwitch ? "destructive" : "default"}
              onClick={() => toggleKillSwitch.mutate()}
              disabled={toggleKillSwitch.isPending || isLoading}
            >
              {toggleKillSwitch.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {globalKillSwitch ? "DISABLE SYSTEM" : "ENABLE SYSTEM"}
            </Button>
          </div>
          {globalKillSwitch && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-sm">
              <p className="text-sm text-destructive font-medium">
                ⚠️ System is currently DISABLED. All operations are blocked.
              </p>
            </div>
          )}
        </Card>

        {/* Rate Limit Stats */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5" />
            Rate Limit Statistics
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rateLimitStats && rateLimitStats.length > 0 ? (
            <div className="space-y-3">
              {rateLimitStats.map((stat: any) => (
                <div key={stat.id} className="flex items-center justify-between p-3 border border-border rounded-sm">
                  <div>
                    <p className="font-mono text-sm">{stat.action}</p>
                    <p className="text-xs text-muted-foreground">User ID: {stat.userId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{stat.count} requests</p>
                    <p className="text-xs text-muted-foreground">
                      Window: {new Date(stat.windowStart).toLocaleTimeString()} - {new Date(stat.windowEnd).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No rate limit data available</p>
          )}
        </Card>

        {/* Audit Logs */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" />
            Recent Audit Logs
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between p-3 border border-border rounded-sm text-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-sm text-xs font-mono ${
                        log.status === 'success' ? 'bg-green-500/10 text-green-500' :
                        log.status === 'blocked' ? 'bg-red-500/10 text-red-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                      <span className="font-mono">{log.action}</span>
                      {log.resource && <span className="text-muted-foreground">→ {log.resource}</span>}
                    </div>
                    {log.details && <p className="text-xs text-muted-foreground mt-1">{log.details}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{new Date(log.createdAt).toLocaleString()}</p>
                    {log.userId && <p>User: {log.userId}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No audit logs available</p>
          )}
        </Card>
      </div>
    </div>
  );
}
