import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, DollarSign, TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";

/**
 * Cost/Profit Dashboard - Track API costs vs revenue
 */
export default function CostDashboard() {
  const { data: overview, isLoading } = trpc.cost.getOverview.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        </main>
      </div>
    );
  }

  const isProfitable = (overview?.profitCents || 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container py-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif italic text-gold mb-2">Cost & Profit Tracker</h1>
            <p className="text-muted-foreground">
              Monitor API costs, revenue, and profit margins in real-time
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Total Revenue */}
            <Card className="bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gold">
                  <AnimatedCounter value={(overview?.totalRevenueCents || 0) / 100} prefix="$" decimals={2} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview?.completedDeals || 0} completed deals
                </p>
              </CardContent>
            </Card>

            {/* Total Costs */}
            <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  API Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-400">
                  <AnimatedCounter value={(overview?.totalCostCents || 0) / 100} prefix="$" decimals={2} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview?.apiCallCount || 0} API calls
                </p>
              </CardContent>
            </Card>

            {/* Profit */}
            <Card className={`bg-gradient-to-br ${isProfitable ? 'from-green-500/10 to-green-500/5 border-green-500/20' : 'from-red-500/10 to-red-500/5 border-red-500/20'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                  {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                  <AnimatedCounter value={(overview?.profitCents || 0) / 100} prefix="$" decimals={2} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview?.profitMarginPercent || 0}% profit margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="font-mono">Cost Breakdown</CardTitle>
              <CardDescription>Where your API budget is going</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* LLM Costs */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="font-mono text-sm">LLM (AI Audits)</p>
                      <p className="text-xs text-muted-foreground">GPT-4 API calls</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg">{formatCurrency(overview?.llmCostCents || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {overview?.totalCostCents ? Math.round((overview.llmCostCents / overview.totalCostCents) * 100) : 0}% of total
                    </p>
                  </div>
                </div>

                {/* Screenshot Costs */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="font-mono text-sm">Screenshots</p>
                      <p className="text-xs text-muted-foreground">Website captures</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg">{formatCurrency(overview?.screenshotCostCents || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {overview?.totalCostCents ? Math.round((overview.screenshotCostCents / overview.totalCostCents) * 100) : 0}% of total
                    </p>
                  </div>
                </div>

                {/* Storage Costs */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="font-mono text-sm">Storage (S3)</p>
                      <p className="text-xs text-muted-foreground">File uploads</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg">{formatCurrency(overview?.storageCostCents || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {overview?.totalCostCents ? Math.round((overview.storageCostCents / overview.totalCostCents) * 100) : 0}% of total
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Efficiency Metrics */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-lg">Cost Per Lead</CardTitle>
                <CardDescription>Average API cost to generate and audit one lead</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gold">
                  {formatCurrency(overview?.costPerLeadCents || 0)}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {overview?.leadCount || 0} total leads
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-lg">Cost Per Deal</CardTitle>
                <CardDescription>Average API cost per completed sale</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gold">
                  {formatCurrency(overview?.costPerDealCents || 0)}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {overview?.completedDeals || 0} closed deals
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ROI Card */}
          <Card className="bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
            <CardHeader>
              <CardTitle className="font-mono text-lg">Return on Investment (ROI)</CardTitle>
              <CardDescription>How much profit you make per dollar spent on APIs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-gold">{overview?.roi || "0.0"}%</span>
                <span className="text-muted-foreground">ROI</span>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {overview?.roi && parseFloat(overview.roi) > 0
                  ? `For every $1 spent on APIs, you make $${((parseFloat(overview.roi) / 100) + 1).toFixed(2)} back.`
                  : "Start closing deals to see your ROI!"}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
