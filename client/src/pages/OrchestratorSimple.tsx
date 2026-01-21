import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";

export default function OrchestratorSimple() {
  const { data: leads, isLoading: leadsLoading, refetch } = trpc.leads.list.useQuery();

  const executePipelineMutation = trpc.orchestrator.executePipeline.useMutation({
    onSuccess: () => {
      toast.success("Audit started! This will take a few minutes.");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to start audit: ${error.message}`);
    },
  });

  const pendingLeads = leads?.filter(lead => lead.status === 'pending') || [];
  const auditedLeads = leads?.filter(lead => lead.status === 'audited') || [];

  const handleAuditAll = async () => {
    if (pendingLeads.length === 0) {
      toast.info("No pending leads to audit");
      return;
    }

    if (!confirm(`Audit ${pendingLeads.length} pending leads? This will take several minutes.`)) {
      return;
    }

    // Execute pipeline for each pending lead
    for (const lead of pendingLeads) {
      try {
        await executePipelineMutation.mutateAsync({ leadId: lead.id });
      } catch (error) {
        console.error(`Failed to audit lead ${lead.id}:`, error);
      }
    }

    toast.success(`Started auditing ${pendingLeads.length} leads!`);
  };

  if (leadsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif italic mb-2">Orchestrator</h1>
            <p className="text-muted-foreground">
              Automatically audit all pending leads with AI-powered website analysis
            </p>
          </div>

          {/* Stats Card */}
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-sm font-mono text-muted-foreground">PENDING AUDITS</h3>
                </div>
                <div className="text-4xl font-serif italic">{pendingLeads.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Waiting to be audited</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <h3 className="text-sm font-mono text-muted-foreground">COMPLETED</h3>
                </div>
                <div className="text-4xl font-serif italic">{auditedLeads.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Ready for outreach</p>
              </div>
            </div>
          </Card>

          {/* Audit All Button */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-serif italic mb-2">Batch Audit</h2>
                <p className="text-sm text-muted-foreground">
                  Click the button below to audit all pending leads. Each audit takes about 30-60 seconds.
                </p>
              </div>

              <Button
                onClick={handleAuditAll}
                disabled={executePipelineMutation.isPending || pendingLeads.length === 0}
                className="w-full gap-2 bg-gold text-black hover:bg-gold/90"
                size="lg"
              >
                {executePipelineMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Audit All {pendingLeads.length} Pending Leads
                  </>
                )}
              </Button>

              {pendingLeads.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  No pending leads. Use the Scraper to find new businesses.
                </p>
              )}
            </div>
          </Card>

          {/* How It Works */}
          <Card className="p-6">
            <h2 className="text-xl font-serif italic mb-4">How It Works</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-500 text-xs font-mono">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Screenshot</p>
                  <p className="text-xs text-muted-foreground">Captures full-page screenshot of the website</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-purple-500 text-xs font-mono">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium">AI Analysis</p>
                  <p className="text-xs text-muted-foreground">LLM analyzes visual design, UX, and content quality</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-500 text-xs font-mono">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Prestige Score</p>
                  <p className="text-xs text-muted-foreground">Generates 0-100 score + detailed problem summary</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-gold text-xs font-mono">4</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Ready for Outreach</p>
                  <p className="text-xs text-muted-foreground">Lead appears in Leads page, ready to email</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
