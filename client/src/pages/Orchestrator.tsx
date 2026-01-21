import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Orchestrator() {
  const [, setLocation] = useLocation();

  // Fetch all leads
  const { data: leads, isLoading: leadsLoading } = trpc.leads.list.useQuery();

  const executePipelineMutation = trpc.orchestrator.executePipeline.useMutation({
    onSuccess: () => {
      toast.success("Pipeline started!", {
        description: "Audit will complete in 2-3 minutes. Check back soon.",
      });
    },
    onError: (error) => {
      toast.error("Pipeline failed", {
        description: error.message,
      });
    },
  });

  const handleExecutePipeline = (leadId: number) => {
    if (confirm("Start automated pipeline for this lead?")) {
      executePipelineMutation.mutate({ leadId });
    }
  };

  if (leadsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold font-serif italic text-foreground">The Orchestrator</h1>
            <p className="text-muted-foreground mt-2">Automated pipeline execution and monitoring</p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/command-center")}>
            ← Back to Dashboard
          </Button>
        </div>

        {/* Pipeline Overview */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Pipeline Stages</CardTitle>
            <CardDescription>Automated workflow from lead creation to outreach draft</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-500 font-mono text-sm">1</span>
                  </div>
                  <h3 className="font-semibold">Screenshot</h3>
                </div>
                <p className="text-sm text-muted-foreground">Capture full-page screenshot via Playwright</p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-500 font-mono text-sm">2</span>
                  </div>
                  <h3 className="font-semibold">Visual Audit</h3>
                </div>
                <p className="text-sm text-muted-foreground">LLM-powered visual debt analysis + prestige score</p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-500 font-mono text-sm">3</span>
                  </div>
                  <h3 className="font-semibold">Asset Generation</h3>
                </div>
                <p className="text-sm text-muted-foreground">3x social posts + 1x web banner using Manus AI</p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center">
                    <span className="text-gold font-mono text-sm">4</span>
                  </div>
                  <h3 className="font-semibold">Outreach Draft</h3>
                </div>
                <p className="text-sm text-muted-foreground">AI-generated personalized email copy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>Execute automated pipeline for any lead</CardDescription>
          </CardHeader>
          <CardContent>
            {!leads || leads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No leads yet. Create a lead from the Dashboard to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{lead.companyName}</h3>
                      <p className="text-sm text-muted-foreground">{lead.websiteUrl}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={lead.status === "pending" ? "secondary" : "default"}>
                          {lead.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/leads/${lead.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleExecutePipeline(lead.id)}
                        disabled={executePipelineMutation.isPending}
                      >
                        {executePipelineMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Execute Pipeline
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
