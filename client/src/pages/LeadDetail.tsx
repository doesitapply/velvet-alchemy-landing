import { useRoute, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function LeadDetail() {
  const [, params] = useRoute("/leads/:id");
  const leadId = params?.id ? parseInt(params.id) : null;
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, error } = trpc.leads.getById.useQuery(
    { id: leadId! },
    { enabled: !!leadId && !!user }
  );

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
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-serif italic">{audit.prestigeScore}</div>
                      <span className="text-sm text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-mono text-muted-foreground mb-2">AUDIT DATE</h3>
                  <p className="text-sm">{new Date(audit.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
