import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, ExternalLink, Eye } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const { data: leads, isLoading: leadsLoading, refetch } = trpc.leads.list.useQuery(undefined, {
    enabled: !!user,
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      setIsCreateDialogOpen(false);
      setCompanyName("");
      setWebsiteUrl("");
      refetch();
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
          <p className="text-muted-foreground font-mono text-sm">
            You must be logged in to access The Curator dashboard.
          </p>
          <Button asChild className="w-full">
            <a href={getLoginUrl()}>Login</a>
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLead.mutate({ companyName, websiteUrl });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div>
            <Link href="/">
              <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/91847194/VumRZfUcLTFVWsnv.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
                <span className="font-serif text-xl italic">Velvet Alchemy</span>
              </a>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground font-mono">
              {user.email}
            </span>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif italic text-2xl">Create Lead</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      placeholder="e.g. Luxury Estates Inc."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createLead.isPending}>
                    {createLead.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Capturing...
                      </>
                    ) : (
                      "Create Lead"
                    )}
                  </Button>
                  {createLead.error && (
                    <p className="text-sm text-destructive">{createLead.error.message}</p>
                  )}
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-serif italic mb-2">The Curator</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Lead acquisition and visual audit system
          </p>
        </div>

        {leadsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !leads || leads.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground font-mono text-sm mb-4">
              No leads yet. Create your first lead to begin.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Lead
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <Card key={lead.id} className="p-6 space-y-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif italic text-xl mb-1">{lead.companyName}</h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-sm font-mono ${
                    lead.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    lead.status === 'audited' ? 'bg-green-500/10 text-green-500' :
                    lead.status === 'contacted' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-gray-500/10 text-gray-500'
                  }`}>
                    {lead.status.toUpperCase()}
                  </span>
                </div>
                
                {lead.screenshotUrl && (
                  <div className="aspect-video bg-muted rounded-sm overflow-hidden border border-border">
                    <img 
                      src={lead.screenshotUrl} 
                      alt={`Screenshot of ${lead.companyName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/leads/${lead.id}`}>
                      <a className="flex items-center justify-center gap-2">
                        <Eye className="h-4 w-4" />
                        View Dossier
                      </a>
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
