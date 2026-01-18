import { useRoute, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function LeadDetail() {
  const [, params] = useRoute("/leads/:id");
  const leadId = params?.id ? parseInt(params.id) : null;
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, error } = trpc.leads.getById.useQuery(
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
            <Link href="/dashboard">
              <a>Back to Dashboard</a>
            </Link>
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
            <Link href="/dashboard">
              <a>Back to Dashboard</a>
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { lead, audit } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <a className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </a>
            </Link>
          </Button>
          <div className="flex-1">
            <Link href="/">
              <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
                <span className="font-serif text-xl italic">Velvet Alchemy</span>
              </a>
            </Link>
          </div>
        </div>
      </header>

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
                <span className={`px-2 py-1 rounded-sm ${
                  lead.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                  lead.status === 'audited' ? 'bg-green-500/10 text-green-500' :
                  lead.status === 'contacted' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-gray-500/10 text-gray-500'
                }`}>
                  {lead.status.toUpperCase()}
                </span>
              </div>
            </div>
            <Button asChild variant="outline">
              <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                Visit Site
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>

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
                            className={`h-full transition-all ${
                              audit.prestigeScore >= 80 ? 'bg-green-500' :
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
                                    <span className={`text-xs px-2 py-1 rounded-sm font-mono ${
                                      item.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
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
                        {asset.type.replace(/_/g, " ")}
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
        </div>
      </main>
    </div>
  );
}
