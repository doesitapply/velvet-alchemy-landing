import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingDown, Search, Zap, BarChart3, CheckCircle2, AlertTriangle } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-black/95">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/91847194/VumRZfUcLTFVWsnv.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
              <span className="font-serif text-xl italic tracking-wide text-gold">Velvet Alchemy</span>
            </a>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-mono text-muted-foreground">
            <a href="/#how-it-works" className="hover:text-foreground transition-colors">HOW IT WORKS</a>
            <a href="/#features" className="hover:text-foreground transition-colors">FEATURES</a>
            <a href="/about" className="text-gold">ABOUT</a>
          </nav>
          <Button variant="outline" className="font-mono text-xs border-white/20 hover:bg-white/5 hover:text-gold rounded-none h-9">
            <a href="/#free-audit">GET FREE AUDIT</a>
          </Button>
        </div>
      </header>

      <div className="pt-24 pb-16">
        <div className="container max-w-4xl">
          {/* Hero */}
          <div className="text-center space-y-6 mb-16">
            <Badge variant="outline" className="border-gold/30 text-gold px-4 py-1">
              About Velvet Alchemy
            </Badge>
            <h1 className="text-5xl md:text-6xl font-serif italic leading-tight">
              Stop Losing Customers to{" "}
              <span className="text-gold">Bad Websites</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              AI-powered website audits that find exactly what's costing you customers—and how to fix it.
            </p>
          </div>

          {/* The Problem */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">The Problem</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                If you own a small business, your website might be costing you thousands of dollars in lost customers every year—and you don't even know it.
              </p>
            </div>

            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-8 w-8 text-red-400 flex-shrink-0 mt-1" />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-semibold">Here's What's Happening</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Your competitors show up on **page 1 of Google** when someone searches "best pizza in Reno" or "plumber near me." You're buried on page 2, 3, or worse. Research shows that **75% of people never scroll past page 1**, which means they're calling your competitors instead of you.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pl-12">
                  <p className="text-muted-foreground font-semibold">Why is this happening?</p>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <TrendingDown className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">**Slow loading times** that make visitors leave before the page even loads</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingDown className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">**No mobile optimization** so it looks broken on phones (where most searches happen)</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingDown className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">**Missing contact information** that's hard to find</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingDown className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">**Poor design** that looks unprofessional and untrustworthy</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingDown className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">**Zero local SEO** so Google doesn't know you exist in your city</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground font-semibold text-red-400 pt-4">
                    Every day your website stays broken, you lose customers to businesses that have their act together online.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* The Solution */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">The Solution</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                **Velvet Alchemy** is an AI-powered website audit service that finds exactly what's wrong with your website and tells you how to fix it.
              </p>
            </div>

            <div className="grid gap-6">
              {/* Step 1 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-gold">1</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">You Submit Your Website</h3>
                      <p className="text-muted-foreground">
                        Takes 30 seconds. Just enter your business name and website URL. No credit card required.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-gold">2</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">Our AI Analyzes Everything</h3>
                      <p className="text-muted-foreground">
                        We capture your site and run it through GPT-4o Vision—the same AI that powers ChatGPT. It literally "looks" at your website the way a customer would and checks mobile optimization, load speed, SEO, design quality, and local search visibility.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 */}
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-gold">3</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">You Get a Detailed Report</h3>
                      <p className="text-muted-foreground">
                        Within 24 hours, you receive a comprehensive audit with your Prestige Score (0-100), specific problems identified, and actionable fixes you can implement immediately.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Real Example */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">Real Example</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We recently audited **Roundabout Pizza** in Reno. Here's what we found:
              </p>
            </div>

            <Card className="bg-gradient-to-br from-gold/5 to-transparent border-gold/20">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">Roundabout Pizza</h3>
                    <p className="text-sm text-muted-foreground">Reno, Nevada</p>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-4 py-2">
                    Prestige Score: 63/100
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-400">CRITICAL ISSUE</p>
                      <p className="text-sm text-muted-foreground">
                        Website says "Best Pizza in **Clearwater**" but they're located in **Reno**. This is killing their local SEO and costing them customers every single day.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pl-8">
                    <p className="text-sm font-semibold text-muted-foreground">Other Issues Found:</p>
                    <div className="grid gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        <p className="text-sm text-muted-foreground">Missing phone number in header - Customers can't call easily</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        <p className="text-sm text-muted-foreground">Poor navigation contrast - Hard to read menu</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        <p className="text-sm text-muted-foreground">Slow image loading - Visitors leave before seeing the food</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-4 border-t border-white/10">
                    <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-400">THE RESULT</p>
                      <p className="text-sm text-muted-foreground">
                        With our report, they know exactly what to fix. These specific issues are costing them customers every single day.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* What You Get */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">What You Get</h2>
            </div>

            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Free Website Audit</p>
                  <p className="text-sm text-muted-foreground">No credit card required. No obligation.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Prestige Score (0-100)</p>
                  <p className="text-sm text-muted-foreground">Instant quality rating based on design, UX, and technical performance</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Local SEO Analysis</p>
                  <p className="text-sm text-muted-foreground">Find out why you're not showing up in "near me" searches</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Performance Audit</p>
                  <p className="text-sm text-muted-foreground">Identify slow load times and technical issues killing conversions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Actionable Recommendations</p>
                  <p className="text-sm text-muted-foreground">Specific, prioritized fixes you can implement immediately</p>
                </div>
              </div>
            </div>
          </section>

          {/* Who This Is For */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">Who This Is For</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-2">
                  <BarChart3 className="h-8 w-8 text-gold" />
                  <h3 className="font-semibold">Local Restaurants</h3>
                  <p className="text-sm text-muted-foreground">Losing customers to competitors with better websites</p>
                </CardContent>
              </Card>
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-2">
                  <Zap className="h-8 w-8 text-gold" />
                  <h3 className="font-semibold">Contractors</h3>
                  <p className="text-sm text-muted-foreground">Plumbers, electricians, HVAC who don't show up in "near me" searches</p>
                </CardContent>
              </Card>
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-2">
                  <Search className="h-8 w-8 text-gold" />
                  <h3 className="font-semibold">Retail Shops</h3>
                  <p className="text-sm text-muted-foreground">Outdated websites that look unprofessional</p>
                </CardContent>
              </Card>
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-6 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-gold" />
                  <h3 className="font-semibold">Service Businesses</h3>
                  <p className="text-sm text-muted-foreground">Dentists, lawyers, salons struggling to get found online</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Why It Matters */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">Why It Matters</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                **Bad websites cost you money.** Here's the math:
              </p>
            </div>

            <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
              <CardContent className="p-8 space-y-4">
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    • Average local business gets **50-100 Google searches per month** for their services in their city
                  </p>
                  <p className="text-muted-foreground">
                    • If you're on page 2-10, you're invisible to **75% of those searchers**
                  </p>
                  <p className="text-muted-foreground">
                    • That's **37-75 lost customers per month**
                  </p>
                  <p className="text-muted-foreground">
                    • If your average sale is $50-200, you're losing **$10,000-$180,000 per year**
                  </p>
                </div>
                <div className="pt-4 border-t border-red-500/20">
                  <p className="text-xl font-semibold text-red-400">
                    One audit can save your business.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* How to Get Started */}
          <section className="space-y-8 mb-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-serif italic text-gold">How to Get Started</h2>
            </div>

            <Card className="bg-black/50 border-white/10">
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">1</span>
                    </div>
                    <p className="text-muted-foreground">Go to the homepage</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">2</span>
                    </div>
                    <p className="text-muted-foreground">Click "Get Your Free Audit"</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">3</span>
                    </div>
                    <p className="text-muted-foreground">Enter your business name and website URL</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">4</span>
                    </div>
                    <p className="text-muted-foreground">Wait 24 hours for your detailed report</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">5</span>
                    </div>
                    <p className="text-muted-foreground">Fix the issues we identify</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">6</span>
                    </div>
                    <p className="text-muted-foreground">Watch your Google rankings improve</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No credit card required. No obligation. Just real answers about why your website isn't working.
                  </p>
                  <Button className="bg-gold hover:bg-gold/90 text-black font-semibold">
                    <a href="/#free-audit" className="flex items-center gap-2">
                      Get Your Free Audit
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* The Bottom Line */}
          <section className="space-y-8">
            <Card className="bg-gradient-to-br from-gold/10 to-transparent border-gold/30">
              <CardContent className="p-8 space-y-4 text-center">
                <h2 className="text-3xl font-serif italic text-gold">The Bottom Line</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Your website is either making you money or costing you money. There's no in-between.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  If you're not showing up on page 1 of Google, your competitors are stealing your customers. **Velvet Alchemy tells you exactly why—and exactly how to fix it.**
                </p>
                <div className="pt-4">
                  <Button className="bg-gold hover:bg-gold/90 text-black font-semibold text-lg h-12 px-8">
                    <a href="/#free-audit">Get Your Free Audit Today</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/91847194/VumRZfUcLTFVWsnv.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
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
