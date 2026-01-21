import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Terminal, Users } from "lucide-react";

export default function LandingHome() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
            <span className="font-serif text-xl italic tracking-wide text-gold">Velvet Alchemy</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-16">
        <div className="container py-20">
          <div className="max-w-5xl mx-auto space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-6">
              <div className="inline-block px-4 py-2 border border-white/20 bg-white/5 rounded-sm mb-4">
                <span className="text-sm font-mono text-terminal">AI-POWERED WEBSITE ANALYSIS</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-serif italic text-foreground">
                Transform Your
                <br />
                <span className="text-gold">Digital Presence</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Professional website audits and lead generation tools powered by artificial intelligence
              </p>
            </div>

            {/* Two-Path Navigation */}
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Customer Portal Card */}
              <Card className="p-8 bg-card border-border hover:border-gold/50 transition-all group">
                <div className="space-y-6">
                  <div className="h-16 w-16 rounded-sm bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                    <Terminal className="h-8 w-8 text-gold" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-serif italic">Get Free Audit</h2>
                    <p className="text-muted-foreground">
                      Instant AI-powered analysis of your website. Get a prestige score and detailed recommendations in minutes.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-gold">✓</span>
                      <span>Full-page screenshot capture</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gold">✓</span>
                      <span>Visual debt analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gold">✓</span>
                      <span>Prestige score (0-100)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gold">✓</span>
                      <span>Actionable recommendations</span>
                    </li>
                  </ul>
                  <Button asChild className="w-full gap-2 bg-gold text-black hover:bg-gold/90" size="lg">
                    <Link href="/customer-portal">
                      <a className="flex items-center gap-2">
                        Start Free Audit
                        <ArrowRight className="h-5 w-5" />
                      </a>
                    </Link>
                  </Button>
                </div>
              </Card>

              {/* Internal Dashboard Card */}
              <Card className="p-8 bg-card border-border hover:border-terminal/50 transition-all group">
                <div className="space-y-6">
                  <div className="h-16 w-16 rounded-sm bg-terminal/10 flex items-center justify-center group-hover:bg-terminal/20 transition-colors">
                    <Users className="h-8 w-8 text-terminal" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-serif italic">Internal Dashboard</h2>
                    <p className="text-muted-foreground">
                      Full access to lead generation tools, batch auditing, outreach management, and analytics.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-terminal">✓</span>
                      <span>Business scraper (Google Maps)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-terminal">✓</span>
                      <span>Automated pipeline orchestration</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-terminal">✓</span>
                      <span>Email outreach & drafts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-terminal">✓</span>
                      <span>Lead management & export</span>
                    </li>
                  </ul>
                  <Button asChild variant="outline" className="w-full gap-2 border-terminal/50 hover:bg-terminal/10" size="lg">
                    <Link href="/command-center">
                      <a className="flex items-center gap-2">
                        Access Dashboard
                        <ArrowRight className="h-5 w-5" />
                      </a>
                    </Link>
                  </Button>
                </div>
              </Card>
            </div>

            {/* Footer Note */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-mono">
                No credit card required • Results in 24 hours • 100% confidential
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
