import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Play, Loader2, CheckCircle2, XCircle, Clock, Zap, Eye, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";

interface Workflow {
  id: string;
  name: string;
  description: string;
  purpose: string;
  icon: React.ReactNode;
  action: () => Promise<void>;
  status?: "idle" | "running" | "completed" | "failed";
  progress?: number;
}

export default function CommandCenter() {
  const [activeWorkflows, setActiveWorkflows] = useState<Record<string, { status: string; progress: number }>>({});
  
  const createLead = trpc.leads.create.useMutation();
  const generateAssets = trpc.visionary.generateAssets.useMutation();
  const generateDraft = trpc.charmer.generateDraft.useMutation();
  const executePipeline = trpc.orchestrator.executePipeline.useMutation();
  
  const workflows: Workflow[] = [
    {
      id: "curator",
      name: "The Curator",
      description: "Capture and audit a lead's website",
      purpose: "Takes a URL, captures a screenshot, and generates an AI-powered visual audit with prestige score (0-100). Identifies design issues, UX problems, and branding gaps.",
      icon: <Eye className="h-6 w-6" />,
      action: async () => {
        const url = prompt("Enter company website URL:");
        const company = prompt("Enter company name:");
        if (!url || !company) return;
        
        setActiveWorkflows(prev => ({ ...prev, curator: { status: "running", progress: 30 } }));
        
        try {
          await createLead.mutateAsync({ companyName: company, websiteUrl: url });
          setActiveWorkflows(prev => ({ ...prev, curator: { status: "completed", progress: 100 } }));
          toast.success("Lead created and audited successfully");
        } catch (error) {
          setActiveWorkflows(prev => ({ ...prev, curator: { status: "failed", progress: 0 } }));
          toast.error("Failed to create lead");
        }
      },
    },
    {
      id: "visionary",
      name: "The Visionary",
      description: "Generate visual assets for a lead",
      purpose: "Extracts brand DNA (colors, fonts, vibe) from the visual audit and generates 3 social media posts + 1 web banner using AI. Creates professional design assets that look like a $10k/month agency made them.",
      icon: <Sparkles className="h-6 w-6" />,
      action: async () => {
        const leadId = prompt("Enter lead ID:");
        if (!leadId) return;
        
        setActiveWorkflows(prev => ({ ...prev, visionary: { status: "running", progress: 40 } }));
        
        try {
          await generateAssets.mutateAsync({ leadId: parseInt(leadId) });
          setActiveWorkflows(prev => ({ ...prev, visionary: { status: "completed", progress: 100 } }));
          toast.success("Assets generated successfully");
        } catch (error) {
          setActiveWorkflows(prev => ({ ...prev, visionary: { status: "failed", progress: 0 } }));
          toast.error("Failed to generate assets");
        }
      },
    },
    {
      id: "charmer",
      name: "The Charmer",
      description: "Generate personalized outreach email",
      purpose: "Creates AI-powered outreach copy based on visual audit findings and generated assets. Saves to approval queue for review before sending. Personalizes messaging to reference specific visual debt issues.",
      icon: <Mail className="h-6 w-6" />,
      action: async () => {
        const leadId = prompt("Enter lead ID:");
        if (!leadId) return;
        
        setActiveWorkflows(prev => ({ ...prev, charmer: { status: "running", progress: 50 } }));
        
        try {
          await generateDraft.mutateAsync({ leadId: parseInt(leadId) });
          setActiveWorkflows(prev => ({ ...prev, charmer: { status: "completed", progress: 100 } }));
          toast.success("Outreach draft generated successfully");
        } catch (error) {
          setActiveWorkflows(prev => ({ ...prev, charmer: { status: "failed", progress: 0 } }));
          toast.error("Failed to generate draft");
        }
      },
    },
    {
      id: "orchestrator",
      name: "The Orchestrator",
      description: "Run the complete automated pipeline",
      purpose: "Executes the full workflow: Screenshot → Visual Audit → Asset Generation → Outreach Draft. Transforms manual steps into a single autonomous operation. Handles errors and retries automatically.",
      icon: <Zap className="h-6 w-6" />,
      action: async () => {
        const leadId = prompt("Enter lead ID:");
        if (!leadId) return;
        
        setActiveWorkflows(prev => ({ ...prev, orchestrator: { status: "running", progress: 0 } }));
        
        try {
          // Simulate progress updates
          const stages = [
            { name: "Screenshot", progress: 25 },
            { name: "Visual Audit", progress: 50 },
            { name: "Asset Generation", progress: 75 },
            { name: "Outreach Draft", progress: 100 },
          ];
          
          for (const stage of stages) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setActiveWorkflows(prev => ({ 
              ...prev, 
              orchestrator: { status: "running", progress: stage.progress } 
            }));
          }
          
          await executePipeline.mutateAsync({ leadId: parseInt(leadId) });
          setActiveWorkflows(prev => ({ ...prev, orchestrator: { status: "completed", progress: 100 } }));
          toast.success("Pipeline executed successfully");
        } catch (error) {
          setActiveWorkflows(prev => ({ ...prev, orchestrator: { status: "failed", progress: 0 } }));
          toast.error("Pipeline execution failed");
        }
      },
    },
  ];

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "running":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Running</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-500 text-green-500">Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="border-red-500 text-red-500">Failed</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-serif italic text-gold">Command Center</h1>
          <p className="text-muted-foreground">
            Launch and monitor autonomous workflows. Each agent executes a specific stage of the revenue pipeline.
          </p>
        </div>

        {/* Workflow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map((workflow) => {
            const workflowState = activeWorkflows[workflow.id];
            const status = workflowState?.status || "idle";
            const progress = workflowState?.progress || 0;

            return (
              <Card key={workflow.id} className="border-white/10 bg-black/50 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-gold/10 text-gold">
                        {workflow.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl font-serif italic text-gold">
                          {workflow.name}
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {workflow.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      {getStatusBadge(status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-mono text-muted-foreground">
                      <span className="text-terminal">PURPOSE:</span> {workflow.purpose}
                    </p>
                  </div>

                  {status === "running" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  <Button
                    onClick={workflow.action}
                    disabled={status === "running"}
                    className="w-full bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20"
                  >
                    {status === "running" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Launch {workflow.name}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Links */}
        <Card className="border-white/10 bg-black/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg font-serif italic text-gold">Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="border-white/20" asChild>
                <a href="/dashboard">View All Leads</a>
              </Button>
              <Button variant="outline" className="border-white/20" asChild>
                <a href="/charmer">Review Drafts</a>
              </Button>
              <Button variant="outline" className="border-white/20" asChild>
                <a href="/governor">Safety Controls</a>
              </Button>
              <Button variant="outline" className="border-white/20" asChild>
                <a href="/orchestrator">Pipeline Monitor</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
