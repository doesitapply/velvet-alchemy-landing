import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, CheckCircle2, DollarSign, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ActivityFeed() {
  const { data: activities, isLoading, refetch } = trpc.dashboard.getActivityFeed.useQuery(
    undefined,
    {
      refetchInterval: 10000, // Auto-refresh every 10 seconds
    }
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "lead_created":
        return <Plus className="h-4 w-4 text-blue-400" />;
      case "audit_completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "payment_received":
        return <DollarSign className="h-4 w-4 text-gold" />;
      case "outreach_sent":
        return <Mail className="h-4 w-4 text-purple-400" />;
      default:
        return <Plus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case "lead_created":
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">New Lead</Badge>;
      case "audit_completed":
        return <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Audit Complete</Badge>;
      case "payment_received":
        return <Badge variant="secondary" className="bg-gold/20 text-gold border-gold/30">Payment</Badge>;
      case "outreach_sent":
        return <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Outreach</Badge>;
      default:
        return <Badge variant="secondary">Activity</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-black/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-gold">Activity Feed</CardTitle>
          <CardDescription>Real-time system activity</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/50 border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gold">Activity Feed</CardTitle>
            <CardDescription>Real-time system activity</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-mono">LIVE</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {activities.map((activity: any) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="mt-1">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActivityBadge(activity.type)}
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
