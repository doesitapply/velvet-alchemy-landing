import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Filter } from "lucide-react";

// Extended export data type that includes the lead ID
type ExportRow = {
  leadId: number;
  companyName: string;
  websiteUrl: string;
  prestigeScore: number | string;
  status: string;
  auditSummary: string;
  topIssues: string;
  visualDebtDetails: string;
  socialPostUrls: string;
  bannerUrls: string;
  screenshotUrl: string;
  createdAt: string;
  auditDate: string;
};

export default function Export() {
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [minPrestigeScore, setMinPrestigeScore] = useState<number | undefined>();
  const [maxPrestigeScore, setMaxPrestigeScore] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<"pending" | "audited" | "contacted" | "closed" | undefined>();

  // Fetch all leads first to get their IDs
  const { data: allLeads } = trpc.leads.list.useQuery();
  
  const { data: exportData, isLoading, refetch } = trpc.export.getExportData.useQuery({
    leadIds: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
    minPrestigeScore,
    maxPrestigeScore,
    status: statusFilter,
  });

  // Merge lead IDs with export data
  const enrichedExportData: ExportRow[] = exportData && allLeads
    ? exportData.map((row, index) => {
        const matchingLead = allLeads.find(
          (lead) => lead.companyName === row.companyName && lead.websiteUrl === row.websiteUrl
        );
        return {
          ...row,
          leadId: matchingLead?.id || index + 1,
        };
      })
    : [];

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const selectAll = () => {
    if (enrichedExportData) {
      const allIds = enrichedExportData.map((row) => row.leadId);
      setSelectedLeadIds(allIds);
    }
  };

  const deselectAll = () => {
    setSelectedLeadIds([]);
  };

  const downloadCSV = () => {
    if (!enrichedExportData || enrichedExportData.length === 0) return;

    const headers = [
      "Lead ID",
      "Company Name",
      "Website URL",
      "Prestige Score",
      "Status",
      "Audit Summary",
      "Top Issues",
      "Visual Debt Details",
      "Social Post URLs",
      "Banner URLs",
      "Screenshot URL",
      "Created At",
      "Audit Date",
    ];

    const csvRows = [
      headers.join(","),
      ...enrichedExportData.map((row) =>
        [
          row.leadId,
          `"${row.companyName}"`,
          `"${row.websiteUrl}"`,
          row.prestigeScore,
          row.status,
          `"${row.auditSummary.replace(/"/g, '""')}"`,
          `"${row.topIssues.replace(/"/g, '""')}"`,
          `"${row.visualDebtDetails.replace(/"/g, '""')}"`,
          `"${row.socialPostUrls}"`,
          `"${row.bannerUrls}"`,
          `"${row.screenshotUrl}"`,
          row.createdAt,
          row.auditDate,
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `velvet-alchemy-leads-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Export Leads</h1>
          <p className="text-muted-foreground">
            Select leads and download a CSV file for your team to start outreach
          </p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value === "all" ? undefined : value)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="audited">Audited</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="minScore">Min Prestige Score</Label>
              <Input
                id="minScore"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={minPrestigeScore || ""}
                onChange={(e) => setMinPrestigeScore(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>

            <div>
              <Label htmlFor="maxScore">Max Prestige Score</Label>
              <Input
                id="maxScore"
                type="number"
                min="0"
                max="100"
                placeholder="100"
                value={maxPrestigeScore || ""}
                onChange={(e) => setMaxPrestigeScore(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={() => refetch()} variant="outline" className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Results */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">
                {enrichedExportData?.length || 0} Leads
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedLeadIds.length} selected
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={selectAll} variant="outline" size="sm">
                Select All
              </Button>
              <Button onClick={deselectAll} variant="outline" size="sm">
                Deselect All
              </Button>
              <Button
                onClick={downloadCSV}
                disabled={!enrichedExportData || enrichedExportData.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading leads...</p>
            </div>
          )}

          {!isLoading && enrichedExportData && enrichedExportData.length === 0 && (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No leads match your filters</p>
            </div>
          )}

          {!isLoading && enrichedExportData && enrichedExportData.length > 0 && (
            <div className="space-y-3">
              {enrichedExportData.map((lead) => (
                <div
                  key={lead.leadId}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedLeadIds.includes(lead.leadId)}
                    onCheckedChange={() => toggleLeadSelection(lead.leadId)}
                  />
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="font-semibold">{lead.companyName}</p>
                      <p className="text-sm text-muted-foreground truncate">{lead.websiteUrl}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Prestige Score</p>
                      <p className="font-semibold">{lead.prestigeScore}/100</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-semibold capitalize">{lead.status}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-semibold">{new Date(lead.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
