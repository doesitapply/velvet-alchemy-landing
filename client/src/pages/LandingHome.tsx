import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, TrendingDown, Search, Zap, BarChart3, Mail, Shield, Target, Cpu, ArrowRight, DollarSign, Clock, Users } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function LandingHome() {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  // Honeypot: hidden field that should stay empty.
  const [hp, setHp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // Funnel-only on Vercel: use a simple serverless endpoint.
  // (We keep tRPC for internal tools later, but the public funnel must be dead-simple.)
  const createLead = {
    mutateAsync: async (input: {
      companyName: string;
      websiteUrl: string;
      contactEmail: string;
      hp?: string;
    }) => {
      const res = await fetch("/api/public-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Lead submit failed");
      }
      return (await res.json()) as { ok: boolean; paymentLinkUrl: string | null };
    },
  };

  const handleFreeAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !websiteUrl || !contactEmail) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsSubmitting(true);
    setProgress(0);
    setProgressMessage("Initializing local scan...");

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) {
          setProgressMessage("Analyzing technographic signals...");
          return prev + 2;
        } else if (prev < 60) {
          setProgressMessage("Calculating capital inefficiency...");
          return prev + 1.5;
        } else if (prev < 90) {
          setProgressMessage("Drafting revenue yield roadmap...");
          return prev + 1;
        } else {
          return prev + 0.5;
        }
      });
    }, 400);

    try {
      const res = await createLead.mutateAsync({ companyName, websiteUrl, contactEmail, hp });
      clearInterval(progressInterval);
      setProgress(100);
      setProgressMessage("Diagnostic record created.");

      // If we have a Stripe payment link configured, send them to it.
      if (res?.paymentLinkUrl) {
        toast.success("Diagnostic request created. Redirecting to payment...");
        window.location.href = res.paymentLinkUrl;
      } else {
        toast.success("Yield Diagnostic requested. We'll email delivery within 24 hours.");
      }

      setCompanyName("");
      setWebsiteUrl("");
      setContactEmail("");
      setHp("");
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("Failed to initialize scan.");
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
        setProgress(0);
        setProgressMessage("");
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-gold/30 selection:text-gold">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="h-10 w-10 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-none border border-gold/50 transition-transform group-hover:rotate-45"></div>
            <div className="flex flex-col">
              <span className="font-serif text-2xl italic tracking-tighter text-gold leading-none">Velvet Alchemy</span>
              <span className="font-mono text-[10px] tracking-widest text-white/40 leading-none mt-1">REVENUE YIELD LOGIC</span>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-10 text-[11px] font-mono tracking-[0.2em] text-white/50">
            <a href="#logic" className="hover:text-gold transition-colors">THE LOGIC</a>
            <a href="#offer" className="hover:text-gold transition-colors">WHAT WE OFFER</a>
            <a href="#pricing" className="hover:text-gold transition-colors">PRICING</a>
            <a href="#team" className="hover:text-gold transition-colors">THE STRATEGIST</a>
          </nav>
          <div className="hidden lg:flex items-center gap-4">
            <Button variant="ghost" className="font-mono text-[10px] text-white/50 hover:text-gold tracking-[0.1em]" asChild>
              <Link href="/command-center">MEMBER LOGIN</Link>
            </Button>
            <Button variant="outline" className="font-mono text-[10px] border-white/10 hover:border-gold/50 hover:bg-gold/5 hover:text-gold rounded-none px-6 h-10 tracking-[0.1em]">
              <a href="#free-audit">INITIATE SCAN</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Obsidian/Gold Luxury Background */}
        <div className="absolute inset-0 z-0">
          <img src="/images/hero.png" alt="Luxury Data Flow" className="w-full h-full object-cover opacity-60 scale-105" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background to-transparent"></div>
        </div>

        <div className="container mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center px-6">
          <div className="space-y-10">
            <Badge variant="outline" className="border-gold/30 text-gold font-mono text-[10px] tracking-widest px-4 py-1">
              RENO_NV JURISDICTIONAL SCAN [ACTIVE]
            </Badge>

            <h1 className="text-6xl md:text-8xl font-serif italic leading-[0.9] text-white">
              Is Your Website <br />
              <span className="text-gold">Burning Capital?</span>
            </h1>

            <p className="text-lg md:text-xl text-white/60 font-mono tracking-tight max-w-xl border-l-[1px] border-gold/40 pl-6">
              High-ticket businesses in Nevada lose an average of $35k/year to "silent" technical leaks. We identify the variance. We build the unblocked state.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="bg-gold text-black rounded-none h-14 px-10 font-mono font-bold hover:scale-105 transition-transform">
                <a href="#free-audit">REQUEST YIELD AUDIT</a>
              </Button>
              <Button variant="outline" className="border-white/20 rounded-none h-14 px-10 font-mono text-white/70 hover:bg-white/5">
                <a href="#logic">VIEW THE METHODOLOGY</a>
              </Button>
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div className="glass-panel p-2 rounded-none border-white/5 shadow-[0_0_50px_rgba(247,231,206,0.1)]">
              <img src="/images/dashboard.png" alt="Revenue Diagnostic Mockup" className="w-full h-auto border border-white/10" />
            </div>
            {/* Floating stats */}
            <div className="absolute -top-10 -right-10 glass-panel p-6 text-center animate-bounce">
              <div className="text-gold font-serif text-3xl italic">18-24%</div>
              <div className="font-mono text-[10px] text-white/40 tracking-widest">AVG YIELD EXPANSION</div>
            </div>
          </div>
        </div>
      </section>

      {/* Logic / Methodology Section */}
      <section id="logic" className="py-32 relative border-y border-white/5 bg-black/20">
        <div className="container mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div className="space-y-4">
              <div className="h-[1px] w-12 bg-gold/50"></div>
              <h3 className="text-2xl italic text-gold">Technographic Audit</h3>
              <p className="text-sm font-mono text-white/50 leading-relaxed">
                We crawl your infrastructure to find missing Meta pixels, broken GA4 schemas, and trust-signal decay that signals "neglect" to high-prestige clients.
              </p>
            </div>
            <div className="space-y-4">
              <div className="h-[1px] w-12 bg-gold/50"></div>
              <h3 className="text-2xl italic text-gold">Visual Debt Analysis</h3>
              <p className="text-sm font-mono text-white/50 leading-relaxed">
                Using custom AI Vision models, we audit your "aesthetic prestige." If your site looks like an 2012 template, you are losing high-ticket trust in seconds.
              </p>
            </div>
            <div className="space-y-4">
              <div className="h-[1px] w-12 bg-gold/50"></div>
              <h3 className="text-2xl italic text-gold">Revenue Guide Protocol</h3>
              <p className="text-sm font-mono text-white/50 leading-relaxed">
                We don't sell "design." We sell the **Unblocked State**. We show you exactly how to stop the bleeding and recapture lost attribution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bio Section */}
      <section id="team" className="py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="relative aspect-[4/5] overflow-hidden grayscale hover:grayscale-0 transition-all duration-700">
              <img src="/images/cameron_alchemy.png" alt="Cameron C." className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-[20px] border-background/20"></div>
              <div className="absolute bottom-10 left-10 p-6 glass-panel border-gold/20">
                <div className="font-serif italic text-3xl text-gold">Cameron C.</div>
                <div className="font-mono text-[10px] tracking-[0.3em] text-white/60">SENIOR YIELD STRATEGIST</div>
              </div>
            </div>
            <div className="space-y-8">
              <Badge variant="outline" className="border-gold/30 text-gold font-mono text-[10px] tracking-widest px-4 py-1">
                THE ARCHITECT
              </Badge>
              <h2 className="text-5xl font-serif italic text-white leading-tight">
                "Technical debt is just <br />
                <span className="text-gold">unpaid revenue."</span>
              </h2>
              <div className="space-y-6 text-white/60 font-mono text-sm leading-relaxed border-l border-gold/20 pl-8">
                <p>
                  Cameron is a Reno-based systems insurgent who built Velvet Alchemy to bridge the gap between "marketing hype" and "mathematical yield."
                </p>
                <p>
                  After years of seeing high-prestige firms in Nevada lose millions to "silent failures"—missing pixels, broken analytics, and aesthetic neglect—he codified the **Revenue Sentry** methodology.
                </p>
                <p>
                  He doesn't build websites. He rebuilds the machinery of capture. He wanders into rooms, identifies the leaks, and leaves before anyone can argue with the math.
                </p>
                <div className="pt-4 flex items-center gap-6">
                  <div className="h-10 w-10 bg-[url('/images/alchemy-symbol.jpg')] bg-cover opacity-50"></div>
                  <span className="text-[10px] tracking-widest uppercase text-white/30">Local Authority: Northern Nevada</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 border-t border-white/5 bg-black/40">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-5xl font-serif italic text-gold">Yield Restoration Tiers</h2>
            <p className="font-mono text-white/40 text-[10px] tracking-[0.4em]">INVEST IN THE MACHINE, NOT THE VENDOR</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sentry Tier */}
            <Card className="glass-panel border-white/10 rounded-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <Shield className="h-20 w-20 text-gold" />
              </div>
              <CardHeader className="p-10">
                <CardTitle className="font-serif text-3xl italic text-white">REVENUE SENTRY</CardTitle>
                <CardDescription className="font-mono text-[10px] tracking-widest text-gold/60 mt-2">FOR EMERGING PRESTIGE</CardDescription>
                <div className="mt-8 flex items-baseline gap-1">
                  <span className="text-4xl font-serif italic text-white">$499</span>
                  <span className="text-sm font-mono text-white/40">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-6">
                <ul className="space-y-3 font-mono text-[11px] text-white/60">
                  <li className="flex items-center gap-2 font-bold text-white"><Check className="h-3 w-3 text-gold" /> 24/7 INFRASTRUCTURE SCAN</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> META PIXEL LOSS PROTECTION</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> MONTHLY YIELD AUDIT</li>
                  <li className="flex items-center gap-2 font-bold"><Check className="h-3 w-3 text-gold" /> LOCAL RENO SEO STATUS</li>
                </ul>
                <Button asChild className="w-full bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-none font-mono text-xs">
                  <a href="#free-audit">COMMENCE SENTRY</a>
                </Button>
              </CardContent>
            </Card>

            {/* Architect Tier */}
            <Card className="glass-panel border-gold/30 rounded-none relative overflow-hidden group bg-gold/5 shadow-[0_0_80px_rgba(247,231,206,0.05)] scale-105 z-10">
              <Badge className="absolute top-4 right-4 bg-gold text-black font-mono text-[9px] rounded-none">MOST REQUESTED</Badge>
              <CardHeader className="p-10">
                <CardTitle className="font-serif text-3xl italic text-white">YIELD ARCHITECT</CardTitle>
                <CardDescription className="font-mono text-[10px] tracking-widest text-gold/60 mt-2">FOR ESTABLISHED ENTITIES</CardDescription>
                <div className="mt-8 flex items-baseline gap-1">
                  <span className="text-4xl font-serif italic text-white">$1,999</span>
                  <span className="text-sm font-mono text-white/40">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-6">
                <ul className="space-y-3 font-mono text-[11px] text-white/60">
                  <li className="flex items-center gap-2 font-bold text-white"><Target className="h-3 w-3 text-gold" /> EVERYTHING IN SENTRY</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> FULL VISUAL DEBT REMOVAL</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> AI LANDING PAGE SYNTHESIS</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> GA4 INSTRUMENTATION FIX</li>
                </ul>
                <Button asChild className="w-full bg-gold text-black hover:bg-gold/80 rounded-none font-mono text-xs font-bold">
                  <a href="#free-audit">REBUILD THE MACHINE</a>
                </Button>
              </CardContent>
            </Card>

            {/* Alchemist Tier */}
            <Card className="glass-panel border-white/10 rounded-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <Cpu className="h-20 w-20 text-gold" />
              </div>
              <CardHeader className="p-10">
                <CardTitle className="font-serif text-3xl italic text-white">REVENUE ALCHEMIST</CardTitle>
                <CardDescription className="font-mono text-[10px] tracking-widest text-gold/60 mt-2">FOR MARKET DOMINANCE</CardDescription>
                <div className="mt-8 flex items-baseline gap-1">
                  <span className="text-4xl font-serif italic text-white">$4,999</span>
                  <span className="text-sm font-mono text-white/40">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-6">
                <ul className="space-y-3 font-mono text-[11px] text-white/60">
                  <li className="flex items-center gap-2 font-bold text-white"><Cpu className="h-3 w-3 text-gold" /> TOTAL AUTONOMOUS CYCLE</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> AUTOPILOT AI LEAD GEN</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> CUSTOM AI AGENT TRAINING</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-gold" /> PRIORITY STRATEGIST ACCESS</li>
                </ul>
                <Button asChild className="w-full bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-none font-mono text-xs">
                  <a href="#free-audit">ESTABLISH DOMINANCE</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Free Audit Form */}
      <section id="free-audit" className="py-40 relative">
        <div className="container mx-auto max-w-2xl text-center space-y-12 px-6">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-serif italic text-white leading-tight">
              Request Your <br />
              <span className="text-gold">Yield Diagnostic.</span>
            </h2>
            <p className="font-mono text-white/40 text-sm tracking-tight"> NO CREDIT CARD. NO PITCH. JUST THE DATA WE LOGGED.</p>
          </div>

          <Card className="glass-panel border-white/10 rounded-none p-8">
            <CardContent className="p-0 space-y-6">
              <form onSubmit={handleFreeAudit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="font-mono text-[10px] tracking-widest text-white/40 ml-1">ENTITY NAME</label>
                    <Input
                      placeholder="e.g. Maier Gutierrez"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-none h-12 focus:border-gold/50 font-mono"
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="font-mono text-[10px] tracking-widest text-white/40 ml-1">INFRASTRUCTURE URL</label>
                    <Input
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-none h-12 focus:border-gold/50 font-mono"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="font-mono text-[10px] tracking-widest text-white/40 ml-1">DELIVERY EMAIL</label>
                    <Input
                      placeholder="you@company.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-none h-12 focus:border-gold/50 font-mono"
                    />
                  </div>

                  {/* Honeypot field (hidden). If a bot fills it, we silently accept and do nothing. */}
                  <div className="hidden" aria-hidden>
                    <label className="font-mono text-[10px] tracking-widest text-white/40 ml-1">DO NOT FILL</label>
                    <Input value={hp} onChange={(e) => setHp(e.target.value)} />
                  </div>
                </div>

                {isSubmitting && (
                  <div className="space-y-2">
                    <div className="w-full bg-white/5 border border-white/10 h-1 overflow-hidden">
                      <div
                        className="h-full bg-gold transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-mono tracking-widest text-gold text-right">
                      {progressMessage.toUpperCase()}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gold hover:bg-gold/90 text-black font-mono font-bold h-14 text-sm"
                >
                  {isSubmitting ? "PROCESSING SCAN..." : "INITIATE DIAGNOSTIC"}
                </Button>
              </form>
              <p className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
                Diagnostic reports are delivered securely within 24 hours.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16 bg-black">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-[url('/images/alchemy-symbol.jpg')] bg-cover opacity-80 border border-gold/30"></div>
                <span className="font-serif text-xl italic text-gold">Velvet Alchemy</span>
              </div>
              <p className="font-mono text-[10px] text-white/20 tracking-widest">BUILT WITH INTENT IN RENO, NV</p>
            </div>

            <div className="flex flex-wrap justify-center gap-10 font-mono text-[10px] tracking-widest text-white/40">
              <Link href="/privacy" className="hover:text-gold transition-colors">PRIVACY_PROTOCOL</Link>
              <Link href="/terms" className="hover:text-gold transition-colors">TERMS_OF_YIELD</Link>
              <Link href="/security" className="hover:text-gold transition-colors">SECURITY_STATUS</Link>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="font-mono text-[10px] tracking-widest text-white/40">SYSTEM STATUS: OPTIMAL</span>
            </div>
          </div>
          <div className="mt-16 text-center border-t border-white/5 pt-8">
            <p className="font-mono text-[9px] text-white/10 tracking-[1em]">MATHEMATICAL CERTAINTY IN REVENUE EXPANSION</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
