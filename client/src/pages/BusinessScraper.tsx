import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function BusinessScraper() {
  const [city, setCity] = useState("Reno");
  const [state, setState] = useState("NV");
  const [category, setCategory] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [limit, setLimit] = useState(20);

  const categoriesQuery = trpc.scraper.getCategories.useQuery();
  const bulkScrapeMutation = trpc.scraper.bulkScrapeAndCreate.useMutation({
    onSuccess: (data) => {
      toast.success("Scrape complete!", {
        description: `Found ${data.createdCount} businesses. Check the Leads page.`,
      });
    },
    onError: (error) => {
      toast.error("Scrape failed", {
        description: error.message,
      });
    },
  });

  const handleScrape = () => {
    if (!category || !targetKeyword) {
      toast.error("Missing fields", {
        description: "Please select a category and enter a target keyword",
      });
      return;
    }

    toast.loading("Scraping businesses...", {
      description: "This may take 30-60 seconds",
    });

    bulkScrapeMutation.mutate({
      city,
      state,
      category,
      targetKeyword,
      limit,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-serif italic text-gold">Business Scraper</h1>
            <Badge variant="outline" className="text-gold border-gold/50">AI-POWERED</Badge>
          </div>
          <p className="text-muted-foreground">
            Intelligently find high-ticket local businesses. Filters out chains and low-quality leads automatically.
          </p>
        </div>

        {/* Scraper Configuration */}
        <Card className="bg-black/50 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-gold">Scrape Configuration</CardTitle>
            <CardDescription>Target businesses in a specific location and category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Reno"
                  className="bg-black/30 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="NV"
                  maxLength={2}
                  className="bg-black/30 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit">Max Results</Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  min={1}
                  max={50}
                  className="bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Business Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesQuery.data?.categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Keyword */}
            <div className="space-y-2">
              <Label htmlFor="keyword">Target Keyword</Label>
              <Input
                id="keyword"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                placeholder="e.g., best pizza, plumber near me, dentist"
                className="bg-black/30 border-white/10"
              />
              <p className="text-xs text-muted-foreground">
                This keyword will be used to check ranking positions for discovered businesses
              </p>
            </div>

            {/* Suggested Keywords */}
            {category && categoriesQuery.data && (
              <div className="space-y-2">
                <Label>Suggested Keywords</Label>
                <div className="flex flex-wrap gap-2">
                  {categoriesQuery.data.categories
                    .find((c) => c.value === category)
                    ?.keywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        className="bg-gold/20 text-gold border-gold/30 cursor-pointer hover:bg-gold/30"
                        onClick={() => setTargetKeyword(keyword)}
                      >
                        {keyword}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={handleScrape}
              disabled={bulkScrapeMutation.isPending || !category || !targetKeyword}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xl px-8 py-6 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-105 transition-all"
            >
              {bulkScrapeMutation.isPending ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  SCRAPING BUSINESSES...
                </>
              ) : (
                <>
                  <Search className="mr-3 h-6 w-6" />
                  START SCRAPING NOW
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {bulkScrapeMutation.data && (
          <Card className="bg-black/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-gold">Scrape Results</CardTitle>
              <CardDescription>
                {bulkScrapeMutation.data.createdCount} leads created from {bulkScrapeMutation.data.totalFound} businesses found
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-muted-foreground">Search Query</span>
                  </div>
                  <p className="text-lg font-semibold">{bulkScrapeMutation.data.query}</p>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-muted-foreground">Leads Created</span>
                  </div>
                  <p className="text-lg font-semibold text-green-400">
                    {bulkScrapeMutation.data.createdCount}
                  </p>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-muted-foreground">Errors</span>
                  </div>
                  <p className="text-lg font-semibold text-red-400">
                    {bulkScrapeMutation.data.errorCount}
                  </p>
                </div>
              </div>

              {/* Created Leads */}
              {bulkScrapeMutation.data.leads.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Created Leads</h3>
                  <div className="space-y-2">
                    {bulkScrapeMutation.data.leads.filter(lead => lead !== null).map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-black/30 border border-white/10 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold">{lead!.companyName}</p>
                          <p className="text-sm text-muted-foreground">{lead!.websiteUrl}</p>
                        </div>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          {lead!.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {bulkScrapeMutation.data.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Errors</h3>
                  <div className="space-y-2">
                    {bulkScrapeMutation.data.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                      >
                        <p className="font-semibold text-red-400">{error.businessName}</p>
                        <p className="text-sm text-muted-foreground">{error.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">Next Steps</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Your leads have been created and are ready for processing. Go to the Orchestrator
                  to run the full pipeline (screenshot → audit → assets → outreach) for all leads.
                </p>
                <Button
                  onClick={() => (window.location.href = "/orchestrator")}
                  variant="outline"
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  Go to Orchestrator
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {bulkScrapeMutation.isError && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-400">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{bulkScrapeMutation.error.message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
