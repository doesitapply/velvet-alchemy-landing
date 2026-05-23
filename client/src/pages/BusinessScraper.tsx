import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, CheckCircle2, XCircle, MapPin, Phone, Star, Users, Zap, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";

export default function BusinessScraper() {
  const [city, setCity] = useState("Reno");
  const [state, setState] = useState("NV");
  const [category, setCategory] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [limit, setLimit] = useState(40);
  const [skipAiFilter, setSkipAiFilter] = useState(false);

  const categoriesQuery = trpc.scraper.getCategories.useQuery();
  const bulkScrapeMutation = trpc.scraper.bulkScrapeAndCreate.useMutation({
    onSuccess: (data) => {
      toast.dismiss();
      toast.success(`${data.createdCount} leads created`, {
        description: `Searched ${data.totalFound} businesses → ${data.preFiltered} passed filters → ${data.deduped} new → ${data.createdCount} saved`,
      });
    },
    onError: (error) => {
      toast.dismiss();
      toast.error("Scrape failed", { description: error.message });
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
      description: `Fetching up to ${limit} results with ${skipAiFilter ? "heuristic-only" : "AI"} filtering`,
    });

    bulkScrapeMutation.mutate({ city, state, category, targetKeyword, limit, skipAiFilter });
  };

  const selectedCat = categoriesQuery.data?.categories.find(c => c.value === category);

  // Group categories by type
  const groups: Record<string, Array<{value: string; label: string; keywords: string[]}>> = {};
  if (categoriesQuery.data) {
    for (const cat of categoriesQuery.data.categories) {
      // Infer group from position in array
      const idx = categoriesQuery.data.categories.indexOf(cat);
      const group = idx < 4 ? "Medical Aesthetics" : idx < 7 ? "Legal" : idx < 14 ? "Home Services" : idx < 17 ? "Luxury & Events" : "Classic";
      if (!groups[group]) groups[group] = [];
      groups[group].push(cat);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-serif italic text-gold mb-2">Lead Scraper</h1>
          <p className="text-muted-foreground">
            Pulls up to 60 real businesses per search from Google Maps. Filters out chains, aggregators, and ghost listings automatically.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { icon: Search, label: "Google Maps", desc: "Up to 60 results (3 pages)" },
            { icon: Filter, label: "Pre-filter", desc: "Remove chains & aggregators" },
            { icon: Users, label: "Dedup", desc: "Skip existing leads" },
            { icon: Zap, label: "AI qualify", desc: "Score lead value" },
            { icon: CheckCircle2, label: "Save leads", desc: "Auto-trigger audits" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
              <Icon className="h-4 w-4 text-gold mx-auto mb-1" />
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Config Card */}
        <Card className="bg-black/50 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-gold">Search Configuration</CardTitle>
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
                <Label htmlFor="state">State (2-letter)</Label>
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
                <Label htmlFor="limit">Max Results (up to 60)</Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={60}
                  className="bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Business Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groups).map(([group, cats]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group}
                      </div>
                      {cats.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Keyword */}
            <div className="space-y-2">
              <Label htmlFor="keyword">Search Keyword</Label>
              <Input
                id="keyword"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                placeholder="e.g., HVAC contractor, personal injury lawyer, med spa"
                className="bg-black/30 border-white/10"
              />
              {selectedCat && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedCat.keywords.map(kw => (
                    <Badge
                      key={kw}
                      className="bg-gold/20 text-gold border-gold/30 cursor-pointer hover:bg-gold/30 text-xs"
                      onClick={() => setTargetKeyword(kw)}
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-3 p-3 bg-black/20 border border-white/10 rounded-lg">
              <Switch
                id="skip-ai"
                checked={skipAiFilter}
                onCheckedChange={setSkipAiFilter}
              />
              <div>
                <Label htmlFor="skip-ai" className="cursor-pointer text-sm font-medium">
                  Skip AI filter (faster, more leads)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Uses heuristics only. Saves AI credits. Good for high-volume scraping.
                </p>
              </div>
            </div>

            {/* CTA */}
            <Button
              onClick={handleScrape}
              disabled={bulkScrapeMutation.isPending || !category || !targetKeyword}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xl px-8 py-6 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-105 transition-all"
            >
              {bulkScrapeMutation.isPending ? (
                <><Loader2 className="mr-3 h-6 w-6 animate-spin" />SCRAPING...</>
              ) : (
                <><Search className="mr-3 h-6 w-6" />SCRAPE {limit} LEADS</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {bulkScrapeMutation.data && (
          <Card className="bg-black/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-gold">Results</CardTitle>
              <CardDescription>{bulkScrapeMutation.data.query}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pipeline Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Found", value: bulkScrapeMutation.data.totalFound, color: "text-blue-400" },
                  { label: "Pre-filtered", value: bulkScrapeMutation.data.preFiltered, color: "text-yellow-400" },
                  { label: "New (deduped)", value: bulkScrapeMutation.data.deduped, color: "text-purple-400" },
                  { label: "AI skipped", value: bulkScrapeMutation.data.skippedByAI, color: "text-orange-400" },
                  { label: "Leads created", value: bulkScrapeMutation.data.createdCount, color: "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Lead List */}
              {bulkScrapeMutation.data.leads.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Created Leads
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {bulkScrapeMutation.data.leads.filter(Boolean).map((lead) => (
                      <Link key={lead!.id} href={`/leads/${lead!.id}`}>
                        <div className="bg-black/30 border border-white/10 rounded-lg p-3 hover:border-gold/30 transition-colors cursor-pointer">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{lead!.companyName}</p>
                              <p className="text-xs text-muted-foreground truncate">{lead!.websiteUrl}</p>
                              <div className="flex items-center gap-3 mt-1">
                                {(lead as any).phone && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {(lead as any).phone}
                                  </span>
                                )}
                                {(lead as any).googleRating && (
                                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                                    <Star className="h-3 w-3 fill-yellow-400" />
                                    {(lead as any).googleRating} ({(lead as any).reviewCount} reviews)
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shrink-0">
                              {lead!.status}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {bulkScrapeMutation.data.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                    Errors ({bulkScrapeMutation.data.errors.length})
                  </h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {bulkScrapeMutation.data.errors.map((error, idx) => (
                      <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                        <p className="text-xs font-semibold text-red-400">{error.businessName}</p>
                        <p className="text-xs text-muted-foreground">{error.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Step */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-blue-400">Audits are running in the background</p>
                  <p className="text-sm text-muted-foreground">
                    Each lead is being screenshotted and scored. Check Leads to see results.
                  </p>
                </div>
                <Button
                  onClick={() => (window.location.href = "/leads")}
                  variant="outline"
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 shrink-0"
                >
                  View Leads
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {bulkScrapeMutation.isError && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-400">Scrape Failed</CardTitle>
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
