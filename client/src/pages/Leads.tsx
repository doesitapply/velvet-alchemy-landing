import { useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, ExternalLink, Eye, Search, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Leads() {
  const { data: leads, isLoading, refetch } = trpc.leads.list.useQuery();
  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead created successfully");
      refetch();
      setDialogOpen(false);
      setCompanyName("");
      setWebsiteUrl("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const filteredLeads = leads?.filter((lead) =>
    lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateLead = () => {
    if (!companyName || !websiteUrl) {
      toast.error("Please fill in all fields");
      return;
    }

    createLead.mutate({ companyName, websiteUrl });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "audited":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "contacted":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "closed":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-serif italic text-gold mb-2">Leads</h1>
            <p className="text-muted-foreground">
              Manage and monitor your high-value targets
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gold text-black hover:bg-gold/90">
                <Plus className="h-4 w-4" />
                Create Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10">
              <DialogHeader>
                <DialogTitle className="text-gold">Create New Lead</DialogTitle>
                <DialogDescription>
                  Enter the company details to capture and audit their website
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="e.g., Luxury Watches Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL</Label>
                  <Input
                    id="websiteUrl"
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateLead}
                  disabled={createLead.isPending}
                  className="bg-gold text-black hover:bg-gold/90"
                >
                  {createLead.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Lead"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by company name or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : filteredLeads && filteredLeads.length > 0 ? (
          <div className="grid gap-4">
            {filteredLeads.map((lead) => (
              <Card
                key={lead.id}
                className="bg-black/50 border-white/10 hover:border-gold/30 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-foreground">
                          {lead.companyName}
                        </h3>
                        <Badge className={getStatusColor(lead.status)}>
                          {lead.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <ExternalLink className="h-4 w-4" />
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-gold transition-colors"
                        >
                          {lead.websiteUrl}
                        </a>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Created {new Date(lead.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <Link href={`/leads/${lead.id}`}>
                      <a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 border-white/20 hover:bg-white/5"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </a>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-black/50 border-white/10">
            <CardContent className="py-12 text-center">
              <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No leads yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first lead to start the revenue engine
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-gold text-black hover:bg-gold/90"
              >
                Create Lead
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
