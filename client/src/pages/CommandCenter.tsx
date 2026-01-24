import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, Users, CheckCircle2, Zap, Search, Play, Activity } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function CommandCenter() {
  const [isAuditingAll, setIsAuditingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isPreScreening, setIsPreScreening] = useState(false);

  const metricsQuery = trpc.dashboard.getMetrics.useQuery();
  const pipelineQuery = trpc.dashboard.getPipelineStats.useQuery();
  const activityQuery = trpc.dashboard.getRecentActivity.useQuery();
  const scoreDistQuery = trpc.dashboard.getScoreDistribution.useQuery();
  const batchAuditMutation = trpc.orchestrator.batchAuditAll.useMutation();
  const prescreenAllMutation = trpc.prescreener.prescreenAll.useMutation();

  const metrics = metricsQuery.data;
  const pipeline = pipelineQuery.data;
  const activity = activityQuery.data;
  const scoreDist = scoreDistQuery.data;

  const isLoading = metricsQuery.isLoading || pipelineQuery.isLoading;

  const handlePreScreenAll = async () => {
    if (!metrics?.pendingAudits) return;
    
    setIsPreScreening(true);
    toast.info(`Pre-screening ${metrics.pendingAudits} leads...`);

    try {
      const result = await prescreenAllMutation.mutateAsync();
      toast.success(`Pre-screened ${result.processed} leads! Check Leads page to see priority scores.`);
      metricsQuery.refetch();
    } catch (error) {
      toast.error(`Pre-screening failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPreScreening(false);
    }
  };

  const handleAuditAll = async () => {
    if (!metrics?.pendingAudits) return;
    
    const confirmed = confirm(`Start batch audit for all ${metrics.pendingAudits} pending leads? This may take several minutes.`);
    if (!confirmed) return;

    setIsAuditingAll(true);
    setBatchProgress({ current: 0, total: metrics.pendingAudits });
    toast.info(`Starting batch audit for ${metrics.pendingAudits} leads...`);

    try {
      await batchAuditMutation.mutateAsync();
      toast.success(`Batch audit completed successfully!`);
      metricsQuery.refetch();
      pipelineQuery.refetch();
    } catch (error) {
      toast.error(`Batch audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAuditingAll(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container py-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif italic text-gold mb-2">Command Center</h1>
            <p className="text-muted-foreground">
              Orchestrate your lead generation and outreach operations
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          )}

          {/* Metrics Grid */}
          {!isLoading && metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Leads */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    Total Leads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-400">{metrics.totalLeads}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{metrics.leadsToday} today
                  </p>
                </CardContent>
              </Card>

              {/* Pending Audits */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-yellow-400" />
                    Pending Audits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-400">{metrics.pendingAudits}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Awaiting analysis
                  </p>
                  {metrics.pendingAudits > 0 && (
                    <div className="space-y-2 mt-4">
                      <Button
                        onClick={() => handlePreScreenAll()}
                        disabled={isPreScreening || isAuditingAll}
                        variant="outline"
                        className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        {isPreScreening ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Pre-screening...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Pre-Screen All (Quick)
                          </>
                        )}
                      </Button>
                      <Link href="/leads">
                        <Button
                          variant="outline"
                          className="w-full border-gold/50 text-gold hover:bg-gold/10"
                        >
                          Select Leads to Audit →
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Audits */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Completed Audits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-400">{metrics.completedAudits}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg score: {metrics.avgPrestigeScore}/100
                  </p>
                </CardContent>
              </Card>

              {/* Conversion Rate */}
              <Card className="bg-black/50 border-white/10">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gold" />
                    Conversion Rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gold">{metrics.conversionRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.withOutreach} outreach sent
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pipeline Funnel */}
          {!isLoading && pipeline && (
            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-gold">Lead Pipeline</CardTitle>
                <CardDescription>Track leads through each stage of the process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Scraped */}
                  <div className="relative">
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Scraped</div>
                      <div className="text-2xl font-bold text-blue-400">{pipeline.scraped}</div>
                    </div>
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-white/20"></div>
                  </div>

                  {/* Audited */}
                  <div className="relative">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Audited</div>
                      <div className="text-2xl font-bold text-green-400">{pipeline.audited}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.scraped > 0 ? Math.round((pipeline.audited / pipeline.scraped) * 100) : 0}% of total
                      </div>
                    </div>
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-white/20"></div>
                  </div>

                  {/* Assets Generated */}
                  <div className="relative">
                    <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Assets</div>
                      <div className="text-2xl font-bold text-purple-400">{pipeline.assets}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.audited > 0 ? Math.round((pipeline.assets / pipeline.audited) * 100) : 0}% of audited
                      </div>
                    </div>
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-white/20"></div>
                  </div>

                  {/* Outreach Sent */}
                  <div>
                    <div className="bg-gold/20 border border-gold/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Outreach</div>
                      <div className="text-2xl font-bold text-gold">{pipeline.outreach}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pipeline.assets > 0 ? Math.round((pipeline.outreach / pipeline.assets) * 100) : 0}% of assets
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Run Scraper */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Search className="h-5 w-5" />
                  Business Scraper
                </CardTitle>
                <CardDescription>
                  Find local businesses and bulk-create leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/scraper">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                    <Search className="mr-2 h-4 w-4" />
                    Launch Scraper
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Start Orchestrator */}
            <Card className="bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20 hover:border-gold/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gold">
                  <Play className="h-5 w-5" />
                  Orchestrator
                </CardTitle>
                <CardDescription>
                  Automate the full pipeline for all leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/orchestrator">
                  <Button className="w-full bg-gold hover:bg-gold/90 text-black">
                    <Play className="mr-2 h-4 w-4" />
                    Run Pipeline
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* View Leads */}
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Users className="h-5 w-5" />
                  Manage Leads
                </CardTitle>
                <CardDescription>
                  View, filter, and manage all your leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/leads">
                  <Button className="w-full bg-green-500 hover:bg-green-600 text-white">
                    <Users className="mr-2 h-4 w-4" />
                    View All Leads
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Score Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {!isLoading && activity && (
              <Card className="bg-black/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-gold">Recent Activity</CardTitle>
                  <CardDescription>Latest updates across all leads</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activity.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No activity yet. Start by scraping some leads!
                      </p>
                    ) : (
                      activity.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.companyName}</p>
                            <p className="text-xs text-muted-foreground">{item.activity}</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score Distribution */}
            {!isLoading && scoreDist && (
              <Card className="bg-black/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-gold">Prestige Score Distribution</CardTitle>
                  <CardDescription>Quality breakdown of audited leads</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Excellent */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">Excellent (80-100)</span>
                      </div>
                      <span className="text-sm font-semibold text-green-400">{scoreDist.excellent}</span>
                    </div>

                    {/* Good */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm">Good (60-79)</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-400">{scoreDist.good}</span>
                    </div>

                    {/* Fair */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm">Fair (40-59)</span>
                      </div>
                      <span className="text-sm font-semibold text-yellow-400">{scoreDist.fair}</span>
                    </div>

                    {/* Poor */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm">Poor (0-39)</span>
                      </div>
                      <span className="text-sm font-semibold text-red-400">{scoreDist.poor}</span>
                    </div>

                    {scoreDist.excellent + scoreDist.good + scoreDist.fair + scoreDist.poor === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No audited leads yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
