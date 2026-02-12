import { useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, ExternalLink, Eye, Search, Plus, Download, Star, Zap, CheckSquare, Square, Camera, Trash2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

export default function Leads() {
  const { data: leads, isLoading, refetch } = trpc.leads.listAll.useQuery();
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
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<"priority" | "prestige" | "date">("priority");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0 });
  const [capturingScreenshot, setCapturingScreenshot] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: number; name: string } | null>(null);

  const batchAuditMutation = trpc.orchestrator.batchAuditSelected.useMutation();

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead deleted successfully");
      refetch();
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncHunter = {
    // Mocking useMutation signature loosely for UI
    isPending: isAuditing, // Re-using state logic or need new state
    mutate: async () => {
      try {
        const secret = import.meta.env.VITE_RELAY_SECRET;
        const res = await fetch("/api/relay/sync", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${secret}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync failed");
        toast.success(`Synced ${data.count} leads from Hunter`);
        refetch();
        setSyncDialogOpen(false);
      } catch (e: any) {
        toast.error(e.message);
        setSyncDialogOpen(false);
      }
    },
    data: null
  };

  const handleDeleteClick = (id: number, name: string) => {
    setLeadToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (leadToDelete) {
      deleteLead.mutate({ id: leadToDelete.id });
    }
  };

  const filteredLeads = leads
    ?.filter((lead) =>
      lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "priority") {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      } else if (sortBy === "prestige") {
        return (b.prestigeScore || 0) - (a.prestigeScore || 0);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const handleCreateLead = () => {
    if (!companyName || !websiteUrl) {
      toast.error("Please fill in all fields");
      return;
    }

    createLead.mutate({ companyName, websiteUrl });
  };

  const handleExportCSV = async () => {
    if (!leads || leads.length === 0) {
      toast.error("No leads to export");
      return;
    }

    const toastId = toast.loading("Preparing CSV export...");

    // Yield to let UI update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // CSV headers
      const headers = ["Company Name", "Website", "Status", "Prestige Score", "Has Assets", "Has Outreach", "Created Date"];
      let csvContent = headers.join(",") + "\n";

      // Process in chunks to avoid blocking UI for too long
      const CHUNK_SIZE = 500;
      const totalLeads = leads.length;

      for (let i = 0; i < totalLeads; i += CHUNK_SIZE) {
        const chunk = leads.slice(i, i + CHUNK_SIZE);

        const chunkRows = chunk.map(lead => [
          lead.companyName,
          lead.websiteUrl,
          lead.status,
          lead.prestigeScore || "Not audited",
          lead.hasAssets ? "Yes" : "No",
          lead.hasOutreach ? "Yes" : "No",
          new Date(lead.createdAt).toLocaleDateString()
        ]);

        csvContent += chunkRows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n") + "\n";

        // Yield to main thread every chunk
        if (i + CHUNK_SIZE < totalLeads) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `velvet-alchemy-leads-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`Exported ${leads.length} leads to CSV`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.dismiss(toastId);
      toast.error("Failed to export CSV");
    }
  };

  const toggleLeadSelection = (leadId: number) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads?.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads?.map(l => l.id)));
    }
  };

  const captureScreenshotMutation = trpc.leads.captureScreenshot.useMutation({
    onSuccess: () => {
      toast.success("Screenshot captured successfully");
      refetch();
      setCapturingScreenshot(null);
    },
    onError: (error) => {
      toast.error(`Failed to capture screenshot: ${error.message}`);
      setCapturingScreenshot(null);
    },
  });

  const handleCaptureScreenshot = async (leadId: number) => {
    setCapturingScreenshot(leadId);
    await captureScreenshotMutation.mutateAsync({ leadId });
  };

  const handleAuditSelected = async () => {
    const leadIds = Array.from(selectedLeads);

    if (leadIds.length === 0) {
      toast.error("No leads selected");
      return;
    }

    if (leadIds.length > 5) {
      toast.error("Maximum 5 leads per batch");
      return;
    }

    setIsAuditing(true);
    setAuditProgress({ current: 0, total: leadIds.length });
    toast.info(`Starting audit for ${leadIds.length} leads...`);

    try {
      // Trigger background processing
      await batchAuditMutation.mutateAsync({ leadIds });

      // Poll for progress every 5 seconds
      const pollInterval = setInterval(async () => {
        const updated = await refetch();
        const completedCount = leadIds.filter(id => {
          const lead = updated.data?.find(l => l.id === id);
          return lead?.status === 'audited';
        }).length;

        setAuditProgress({ current: completedCount, total: leadIds.length });

        if (completedCount === leadIds.length) {
          clearInterval(pollInterval);
          setIsAuditing(false);
          setAuditProgress({ current: 0, total: 0 });
          setSelectedLeads(new Set());
          toast.success(`✓ All ${leadIds.length} leads audited successfully`);
        }
      }, 5000);

      // Stop polling after 10 minutes (safety)
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsAuditing(false);
        setAuditProgress({ current: 0, total: 0 });
      }, 600000);

    } catch (error) {
      toast.error(`Batch audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsAuditing(false);
      setAuditProgress({ current: 0, total: 0 });
    }
  };

  const getPriorityColor = (score: number | null) => {
    if (!score) return "text-gray-500";
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
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

          <div className="flex gap-3">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="gap-2 border-gold/30 text-gold hover:bg-gold/10"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>

            <Button
              onClick={() => setSyncDialogOpen(true)}
              variant="outline"
              disabled={syncHunter.isPending}
              className="gap-2 border-gold/30 text-gold hover:bg-gold/10"
            >
              <RefreshCw className={`h-4 w-4 ${syncHunter.isPending ? "animate-spin" : ""}`} />
              Sync Hunter
            </Button>

            <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
              <DialogContent className="bg-black border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-gold">Sync from Hunter</DialogTitle>
                  <DialogDescription>
                    This will fetch leads from your external Hunter instance.
                    <br /><br />
                    <strong className="text-white">Prerequisites:</strong>
                    <ul className="list-disc pl-4 mt-2 mb-4">
                      <li>Local server must be running</li>
                      <li>ngrok must be active (if using relay)</li>
                    </ul>
                    Are you ready to proceed?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSyncDialogOpen(false)}
                    className="border-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => syncHunter.mutate()}
                    className="bg-gold text-black hover:bg-gold/90"
                  >
                    Yes, Sync Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by company name or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-2 border-white/20"
              >
                {selectedLeads.size === filteredLeads?.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : "Select All"}
              </Button>

              {selectedLeads.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleAuditSelected}
                  disabled={isAuditing || selectedLeads.size > 5}
                  className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                >
                  {isAuditing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {auditProgress.current} of {auditProgress.total}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Audit Selected ({selectedLeads.size})
                      {selectedLeads.size > 5 && " - Max 5"}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Button
                variant={sortBy === "priority" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("priority")}
                className="gap-1"
              >
                <Star className="h-3 w-3" />
                Priority
              </Button>
              <Button
                variant={sortBy === "prestige" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("prestige")}
              >
                Prestige
              </Button>
              <Button
                variant={sortBy === "date" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("date")}
              >
                Date
              </Button>
            </div>
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
                  <div className="flex items-start gap-4">
                    <div className="pt-1">
                      <button
                        onClick={() => toggleLeadSelection(lead.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selectedLeads.has(lead.id) ? (
                          <CheckSquare className="h-5 w-5 text-cyan-400" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </div>

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

                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-muted-foreground">
                          Created {new Date(lead.createdAt).toLocaleDateString()}
                        </div>
                        {lead.priorityScore !== null && (
                          <div className="flex items-center gap-1">
                            <Star className={`h-4 w-4 ${getPriorityColor(lead.priorityScore)}`} />
                            <span className={getPriorityColor(lead.priorityScore)}>
                              Priority: {lead.priorityScore}/100
                            </span>
                          </div>
                        )}
                        {lead.prestigeScore !== null && (
                          <div className="text-muted-foreground">
                            Prestige: {lead.prestigeScore}/100
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!lead.screenshotUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCaptureScreenshot(lead.id)}
                          disabled={capturingScreenshot === lead.id}
                          className="gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        >
                          {capturingScreenshot === lead.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Capturing...
                            </>
                          ) : (
                            <>
                              <Camera className="h-4 w-4" />
                              Capture Screenshot
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="gap-2 border-white/20 hover:bg-white/5"
                      >
                        <Link href={`/leads/${lead.id}`} className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(lead.id, lead.companyName)}
                        className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        itemName={leadToDelete?.name}
        title="Delete Lead"
        description="This will permanently delete this lead and all associated data (audits, assets, outreach). This action cannot be undone."
      />
    </div >
  );
}
