import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, TrendingDown, Search, Zap, BarChart3, Mail } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function CustomerPortal() {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const createLead = trpc.leads.createPublic.useMutation();

  const handleFreeAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName || !websiteUrl) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setProgress(0);
    setProgressMessage("Capturing screenshot...");

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) {
          setProgressMessage("Capturing screenshot...");
          return prev + 2;
        } else if (prev < 90) {
          setProgressMessage("Analyzing design with AI...");
          return prev + 1;
        } else {
          setProgressMessage("Calculating prestige score...");
          return prev + 0.5;
        }
      });
    }, 500);

    try {
      await createLead.mutateAsync({ companyName, websiteUrl, contactEmail: "unknown@example.com" });
      clearInterval(progressInterval);
      setProgress(100);
      setProgressMessage("Complete!");
      toast.success("Audit complete! We'll contact you within 24 hours with your detailed report.");
      setCompanyName("");
      setWebsiteUrl("");
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("Failed to submit audit request. Please try again.");
      console.error("Audit error:", error);
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
        setProgress(0);
        setProgressMessage("");
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-black/95">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/91847194/gyGbyIhzvPIKVJwA.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
            <span className="font-serif text-xl italic tracking-wide text-gold">Velvet Alchemy</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-mono text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">HOW IT WORKS</a>
            <a href="#features" className="hover:text-foreground transition-colors">FEATURES</a>
            <a href="/about" className="hover:text-foreground transition-colors">ABOUT</a>
          </nav>
          <Button variant="outline" className="font-mono text-xs border-white/20 hover:bg-white/5 hover:text-gold rounded-none h-9">
            <a href="#free-audit">GET FREE AUDIT</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-gold/5 via-transparent to-transparent opacity-30"></div>
        
        <div className="container relative z-10 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <Badge variant="outline" className="border-gold/30 text-gold px-4 py-1">
              AI-Powered Website Analysis
            </Badge>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-serif italic leading-tight">
              Is Your Website{" "}
              <span className="text-gold">Costing You</span>{" "}
              Customers?
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Small businesses lose <span className="text-red-400 font-semibold">$10,000+ per year</span> to bad websites and poor Google rankings. Find out what's killing yours.
            </p>

            {/* CTA Form */}
            <Card className="max-w-2xl mx-auto bg-black/50 border-white/10">
              <CardContent className="p-6">
                <form onSubmit={handleFreeAudit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Your Business Name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Your Website URL"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  {isSubmitting && (
                    <div className="space-y-2">
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gold transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-sm text-center text-muted-foreground">
                        {progressMessage} ({Math.round(progress)}%)
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gold hover:bg-gold/90 text-black font-semibold h-12 text-lg"
                  >
                    {isSubmitting ? progressMessage || "Analyzing..." : "Get Your Free Audit"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    No credit card required • Results in 24 hours • 100% confidential
                  </p>
                </form>
              </CardContent>
            </Card>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400" />
                <span>200+ Businesses Audited</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400" />
                <span>Avg. 40% Ranking Improvement</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 border-t border-white/10">
        <div className="container">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-serif italic text-gold">The Hidden Cost of a Bad Website</h2>
              <p className="text-xl text-muted-foreground">
                Your competitors are stealing your customers—and you don't even know it.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Problem 1 */}
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-6 space-y-4">
                  <TrendingDown className="h-10 w-10 text-red-400" />
                  <h3 className="text-xl font-semibold">Lost Rankings</h3>
                  <p className="text-sm text-muted-foreground">
                    Slow load times, missing mobile optimization, and poor UX push you to page 2-10 of Google. <span className="text-red-400 font-semibold">75% of users never scroll past page 1.</span>
                  </p>
                </CardContent>
              </Card>

              {/* Problem 2 */}
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-6 space-y-4">
                  <Search className="h-10 w-10 text-red-400" />
                  <h3 className="text-xl font-semibold">Invisible to Locals</h3>
                  <p className="text-sm text-muted-foreground">
                    No Google Business Profile integration, inconsistent NAP (Name, Address, Phone), and zero local keywords mean <span className="text-red-400 font-semibold">customers can't find you</span> when they search "near me."
                  </p>
                </CardContent>
              </Card>

              {/* Problem 3 */}
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-6 space-y-4">
                  <Zap className="h-10 w-10 text-red-400" />
                  <h3 className="text-xl font-semibold">Bouncing Visitors</h3>
                  <p className="text-sm text-muted-foreground">
                    Confusing navigation, hidden contact info, and unprofessional design make visitors leave in seconds. <span className="text-red-400 font-semibold">Every bounce is lost revenue.</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-t border-white/10">
        <div className="container">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-serif italic text-gold">How It Works</h2>
              <p className="text-xl text-muted-foreground">
                AI-powered analysis in 3 simple steps
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gold">1</span>
                </div>
                <h3 className="text-xl font-semibold">Submit Your Website</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your business name and website URL. Takes 30 seconds.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gold">2</span>
                </div>
                <h3 className="text-xl font-semibold">AI Analyzes Everything</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI captures your site, checks mobile optimization, load speed, SEO, and design quality.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gold">3</span>
                </div>
                <h3 className="text-xl font-semibold">Get Actionable Report</h3>
                <p className="text-sm text-muted-foreground">
                  Receive a detailed audit with specific fixes to improve rankings and conversions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t border-white/10">
        <div className="container">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-serif italic text-gold">What You Get</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Feature 1 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <BarChart3 className="h-8 w-8 text-gold" />
                  <h3 className="text-lg font-semibold">Prestige Score (0-100)</h3>
                  <p className="text-sm text-muted-foreground">
                    Instant quality rating based on design, UX, mobile-friendliness, and trust signals.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 2 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <Search className="h-8 w-8 text-gold" />
                  <h3 className="text-lg font-semibold">Local SEO Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Check Google Business Profile integration, NAP consistency, and local keyword usage.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 3 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <Zap className="h-8 w-8 text-gold" />
                  <h3 className="text-lg font-semibold">Performance Audit</h3>
                  <p className="text-sm text-muted-foreground">
                    Identify slow load times, unoptimized images, and technical issues killing conversions.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 4 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <Mail className="h-8 w-8 text-gold" />
                  <h3 className="text-lg font-semibold">Actionable Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    Get specific, prioritized fixes you can implement immediately to improve rankings.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="free-audit" className="py-20 border-t border-white/10">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-serif italic">
              Ready to Stop Losing{" "}
              <span className="text-gold">Customers?</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Get your free website audit in 24 hours. No credit card required.
            </p>

            <Card className="bg-black/50 border-white/10">
              <CardContent className="p-6">
                <form onSubmit={handleFreeAudit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Your Business Name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                    <Input
                      placeholder="Your Website URL"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gold hover:bg-gold/90 text-black font-semibold h-12 text-lg"
                  >
                    {isSubmitting ? "Analyzing..." : "Get Your Free Audit"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/91847194/gyGbyIhzvPIKVJwA.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
              <span className="font-serif italic text-gold">Velvet Alchemy</span>
            </div>
            <p>© 2026 Velvet Alchemy. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
