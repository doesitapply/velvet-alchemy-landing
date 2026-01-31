import { Link, useRoute } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, ExternalLink, Sparkles, Mail, Send, Play, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { EmailComposeDialog } from "@/components/EmailComposeDialog";
import AppHeader from "@/components/AppHeader";
import { AuditProgressBar } from "@/components/AuditProgressBar";
import { ReportDrawer } from "@/components/ReportDrawer";
import { WebsiteEditorModal, WebsiteCustomizations } from "@/components/WebsiteEditorModal";

export default function LeadDetail() {
  const [, params] = useRoute("/leads/:id");
  const leadId = params?.id ? parseInt(params.id) : null;
  const { user, loading: authLoading } = useAuth();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<'basic' | 'standard' | 'premium'>('standard');

  const { data, isLoading, error, refetch } = trpc.leads.getById.useQuery(
    { id: leadId! },
    { enabled: !!leadId && !!user }
  );

  const { data: assets, isLoading: assetsLoading, refetch: refetchAssets } = trpc.visionary.getAssets.useQuery(
    { leadId: leadId! },
    { enabled: !!leadId && !!user }
  );

  const generateAssets = trpc.visionary.generateAssets.useMutation({
    onSuccess: () => {
      toast.success("Assets generated successfully!");
      refetchAssets();
    },
    onError: (error: any) => {
      toast.error(`Failed to generate assets: ${error.message}`);
    },
  });

  const generateDraft = trpc.charmer.generateDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft generated! Check the Charmer page to review.");
    },
    onError: (error: any) => {
      toast.error(`Failed to generate draft: ${error.message}`);
    },
  });

  const generateOutreach = trpc.outreach.generateOutreachEmail.useMutation({
    onSuccess: () => {
      toast.success("Outreach email generated! Check the Approval Queue to review.");
      window.location.href = "/outreach-approval";
    },
    onError: (error: any) => {
      toast.error(`Failed to generate outreach: ${error.message}`);
    },
  });

  const generateWebsite = trpc.websiteGenerator.generate.useMutation({
    onSuccess: (data) => {
      toast.success("Website generated! Opening editor...");
      setGeneratedHtml(data.html || "");
      setEditorModalOpen(true);
    },
    onError: (error: any) => {
      toast.error(`Failed to generate website: ${error.message}`);
    },
  });

  const saveCustomizations = trpc.websiteGenerator.saveCustomizations.useMutation({
    onSuccess: () => {
      toast.success("Website updated successfully!");
      setEditorModalOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to save customizations: ${error.message}`);
    },
  });

  const handleSaveCustomizations = (customizations: WebsiteCustomizations) => {
    saveCustomizations.mutate({
      leadId: leadId!,
      customizations,
    });
  };

  const downloadWebsite = trpc.websiteGenerator.downloadZip.useMutation({
    onSuccess: async (data) => {
      toast.success("Downloading website...");
      // Trigger browser download
      const link = document.createElement('a');
      link.href = `/api/download/${data.filename}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onError: (error: any) => {
      toast.error(`Failed to download website: ${error.message}`);
    },
  });

  const createInvoice = trpc.payment.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        // Copy to clipboard
        navigator.clipboard.writeText(data.checkoutUrl);
        toast.success("Payment link copied to clipboard!");
        // Open in new tab
        window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to create payment link: ${error.message}`);
    },
  });



  const sendDirectEmail = trpc.charmer.sendDirectEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent successfully!");
      setEmailDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  // Email generation query (returns email content for manual sending via Gmail MCP)
  const [emailData, setEmailData] = useState<any>(null);

  const handleGenerateEmail = async () => {
    try {
      const utils = trpc.useUtils();
      const result = await utils.email.generateOutreach.fetch({ leadId: leadId! });
      setEmailData(result);

      // Copy email to clipboard for easy pasting
      const emailText = `To: ${result.to}\nSubject: ${result.subject}\n\n${result.body}`;
      await navigator.clipboard.writeText(emailText);

      toast.success("Email content copied to clipboard! Use Gmail to send.");
    } catch (error: any) {
      toast.error(`Failed to generate email: ${error.message}`);
    }
  };

  const startAudit = trpc.orchestrator.executePipeline.useMutation({
    onSuccess: () => {
      toast.success("Audit started! This will take 2-3 minutes.");
      // No need to refetch - AuditProgressBar will handle updates
    },
    onError: (error: any) => {
      toast.error(`Failed to start audit: ${error.message}`);
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-serif italic">Authentication Required</h2>
          <Button asChild className="w-full">
            <a href={getLoginUrl()}>Login</a>
          </Button>
        </Card>
      </div>
    );
  }

  if (!leadId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-serif italic">Invalid Lead ID</h2>
          <Button asChild>
            <Link href="/command-center">Back to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-serif italic">Lead Not Found</h2>
          <p className="text-muted-foreground font-mono text-sm">
            {error?.message || "The requested lead could not be found."}
          </p>
          <Button asChild>
            <Link href="/command-center">Back to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { lead, audit } = data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main Content */}
      <main className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Lead Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-serif italic mb-2">{lead.companyName}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                <span>Created: {new Date(lead.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span className={`px-2 py-1 rounded-sm ${lead.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    lead.status === 'audited' ? 'bg-green-500/10 text-green-500' :
                      lead.status === 'contacted' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-gray-500/10 text-gray-500'
                  }`}>
                  {lead.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lead.status === 'pending' && (
                <Button
                  onClick={() => startAudit.mutate({ leadId: lead.id })}
                  disabled={startAudit.isPending}
                  size="lg"
                  className="gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 text-xl px-8 py-6 font-bold shadow-lg shadow-cyan-500/50 border-2 border-cyan-400/50 transition-all duration-300 hover:scale-105"
                >
                  {startAudit.isPending ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Starting Audit...
                    </>
                  ) : (
                    <>
                      <Play className="h-6 w-6" />
                      START AUDIT NOW
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white/30 gap-2"
                onClick={() => window.open(lead.websiteUrl, "_blank", "noopener,noreferrer")}
              >
                Visit Site
                <ExternalLink className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          {lead.status === 'pending' && (
            <AuditProgressBar
              leadId={lead.id}
              onComplete={() => {
                toast.success("Audit completed!");
                refetch(); // Refetch lead data instead of reloading page
              }}
              onError={(error) => {
                toast.error(`Audit failed: ${error}`);
              }}
            />
          )}

          {/* Screenshot */}
          {lead.screenshotUrl && (
            <Card className="p-4">
              <h2 className="text-xl font-serif italic mb-4">Visual Capture</h2>
              <div className="border border-border rounded-sm overflow-hidden">
                <img
                  src={lead.screenshotUrl}
                  alt={`Screenshot of ${lead.companyName}`}
                  className="w-full h-auto"
                />
              </div>
            </Card>
          )}

          {/* Audit Summary */}
          {audit && (
            <Card className="p-6">
              <h2 className="text-xl font-serif italic mb-4">Audit Report</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-mono text-muted-foreground mb-2">SUMMARY</h3>
                  <p className="text-sm">{audit.summary || "No summary available"}</p>
                </div>

                {audit.prestigeScore !== null && (
                  <div>
                    <h3 className="text-sm font-mono text-muted-foreground mb-2">PRESTIGE SCORE</h3>
                    <div className="flex items-center gap-4">
                      <div className="text-5xl font-serif italic">{audit.prestigeScore}</div>
                      <div className="flex-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${audit.prestigeScore >= 80 ? 'bg-green-500' :
                                audit.prestigeScore >= 60 ? 'bg-yellow-500' :
                                  audit.prestigeScore >= 40 ? 'bg-orange-500' :
                                    'bg-red-500'
                              }`}
                            style={{ width: `${audit.prestigeScore}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {audit.prestigeScore >= 80 ? 'Exceptional' :
                            audit.prestigeScore >= 60 ? 'Good' :
                              audit.prestigeScore >= 40 ? 'Needs Improvement' :
                                'Critical Issues'}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setReportDrawerOpen(true)}
                      variant="outline"
                      className="mt-4"
                    >
                      View Detailed Report
                    </Button>
                  </div>
                )}

                {/* Visual Debt Breakdown */}
                {audit.visualDebtData && (() => {
                  try {
                    const auditData = JSON.parse(audit.visualDebtData);
                    return (
                      <>
                        {/* Strengths & Weaknesses */}
                        <div className="grid md:grid-cols-2 gap-4">
                          {auditData.strengths && auditData.strengths.length > 0 && (
                            <div>
                              <h3 className="text-sm font-mono text-muted-foreground mb-2">STRENGTHS</h3>
                              <ul className="space-y-1">
                                {auditData.strengths.map((strength: string, i: number) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span>{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {auditData.weaknesses && auditData.weaknesses.length > 0 && (
                            <div>
                              <h3 className="text-sm font-mono text-muted-foreground mb-2">WEAKNESSES</h3>
                              <ul className="space-y-1">
                                {auditData.weaknesses.map((weakness: string, i: number) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-red-500 mt-0.5">✗</span>
                                    <span>{weakness}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Visual Debt Items */}
                        {auditData.visualDebt && auditData.visualDebt.length > 0 && (
                          <div>
                            <h3 className="text-sm font-mono text-muted-foreground mb-3">VISUAL DEBT ANALYSIS</h3>
                            <div className="space-y-3">
                              {auditData.visualDebt.map((item: any, i: number) => (
                                <div key={i} className="border border-border rounded-sm p-4 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-sm font-mono ${item.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                                        item.severity === 'high' ? 'bg-orange-500/10 text-orange-500' :
                                          item.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                            'bg-blue-500/10 text-blue-500'
                                      }`}>
                                      {item.severity.toUpperCase()}
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded-sm font-mono bg-muted">
                                      {item.category.toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{item.issue}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      <span className="font-mono text-xs">→</span> {item.recommendation}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}

                <div>
                  <h3 className="text-sm font-mono text-muted-foreground mb-2">AUDIT DATE</h3>
                  <p className="text-sm">{new Date(audit.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Assets Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif italic">Generated Assets</h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => generateAssets.mutate({ leadId: leadId! })}
                  disabled={generateAssets.isPending || assetsLoading}
                  variant="default"
                >
                  {generateAssets.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Assets
                    </>
                  )}
                </Button>
                {lead.status === 'audited' && lead.detailedReport && (
                  <>
                    <Button
                      onClick={() => generateWebsite.mutate({ leadId: leadId! })}
                      disabled={generateWebsite.isPending}
                      variant="default"
                      className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500"
                    >
                      {generateWebsite.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Website...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Website
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => downloadWebsite.mutate({ leadId: leadId! })}
                      disabled={downloadWebsite.isPending}
                      variant="outline"
                      className="border-green-500 text-green-500 hover:bg-green-500/10"
                    >
                      {downloadWebsite.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Download ZIP
                        </>
                      )}
                    </Button>
                    <Select
                      value={selectedPackage}
                      onValueChange={(value: 'basic' | 'standard' | 'premium') => setSelectedPackage(value)}
                    >
                      <SelectTrigger className="w-[280px] border-2 border-gold/30 bg-background/50">
                        <SelectValue placeholder="Select package" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">
                          <div className="flex flex-col">
                            <span className="font-bold">💎 Basic - $3,000</span>
                            <span className="text-xs text-muted-foreground">Single-page website</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="standard">
                          <div className="flex flex-col">
                            <span className="font-bold">🏆 Standard - $5,000</span>
                            <span className="text-xs text-muted-foreground">Multi-page website</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="premium">
                          <div className="flex flex-col">
                            <span className="font-bold">👑 Premium - $8,000</span>
                            <span className="text-xs text-muted-foreground">Full website + extras</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => createInvoice.mutate({
                        leadId: leadId!,
                        packageType: selectedPackage
                      })}
                      disabled={createInvoice.isPending}
                      variant="default"
                      className="bg-gradient-to-r from-gold to-yellow-600 hover:from-gold/90 hover:to-yellow-500 text-black font-bold"
                    >
                      {createInvoice.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Send Invoice
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {assetsLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : assets && assets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assets.map((asset: any) => (
                  <div key={asset.id} className="border border-border rounded-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono uppercase text-muted-foreground">
                        {(asset.type || '').replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <img
                      src={asset.url}
                      alt={asset.type}
                      className="w-full rounded-sm border border-border"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(asset.url, "_blank")}
                    >
                      View Full Size
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  No assets generated yet. Click "Generate Assets" to create high-fidelity visual assets for this lead.
                </p>
              </div>
            )}
          </Card>

          {/* Outreach Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif italic">Outreach</h2>
              <div className="flex items-center gap-2">
                {data.lead.status === 'audited' && data.lead.detailedReport && (
                  <Button
                    onClick={handleGenerateEmail}
                    variant="default"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Copy Email to Clipboard
                  </Button>
                )}
                <Button
                  onClick={() => setEmailDialogOpen(true)}
                  variant="outline"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Custom Email
                </Button>
                <Button
                  onClick={() => generateDraft.mutate({ leadId: leadId! })}
                  disabled={generateDraft.isPending}
                  variant="outline"
                >
                  {generateDraft.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Draft...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Generate Draft (Old)
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    generateOutreach.mutate({ leadId: leadId! });
                  }}
                  disabled={generateOutreach.isPending}
                >
                  {generateOutreach.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate AI Outreach
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Send an email directly or generate a personalized draft based on the visual audit.
            </p>
          </Card>

          {/* Email Compose Dialog */}
          <EmailComposeDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            defaultTo=""
            defaultSubject={`Website Audit Results - ${lead.companyName}`}
            defaultBody={audit ? `Hi,\n\nI recently reviewed ${lead.companyName}'s website (${lead.websiteUrl}) and wanted to share some insights.\n\nPrestige Score: ${audit.prestigeScore}/100\n\nSummary: ${audit.summary}\n\nI'd love to discuss how we can help improve your online presence.\n\nBest regards` : `Hi,\n\nI wanted to reach out regarding ${lead.companyName}'s website.\n\nBest regards`}
            onSend={async (data) => {
              await sendDirectEmail.mutateAsync({
                leadId: leadId!,
                to: data.to,
                subject: data.subject,
                body: data.body,
              });
            }}
            isLoading={sendDirectEmail.isPending}
          />

          {/* Report Drawer */}
          <ReportDrawer
            isOpen={reportDrawerOpen}
            onClose={() => setReportDrawerOpen(false)}
            companyName={lead.companyName}
            prestigeScore={audit?.prestigeScore || 0}
            detailedReport={lead.detailedReport ? JSON.parse(lead.detailedReport) : null}
          />

          {/* Website Editor Modal */}
          <WebsiteEditorModal
            open={editorModalOpen}
            onOpenChange={setEditorModalOpen}
            leadId={leadId!}
            initialHtml={generatedHtml}
            onSave={handleSaveCustomizations}
            isSaving={saveCustomizations.isPending}
          />
        </div>
      </main>
    </div>
  );
}
