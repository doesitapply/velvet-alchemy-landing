import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Zap, DollarSign, TrendingUp, Clock, Shield, Sparkles, Target, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useState } from "react";

export default function Home() {
  const [leadsFound, setLeadsFound] = useState(10);
  const potentialRevenue = leadsFound * 5000;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-gold to-yellow-600 rounded-sm"></div>
            <span className="font-serif text-xl italic tracking-wide text-gold">Velvet Alchemy</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hidden md:inline text-sm hover:text-gold transition-colors">Pricing</a>
            <a href="#how-it-works" className="hidden md:inline text-sm hover:text-gold transition-colors">How It Works</a>
            <Button 
              asChild
              variant="outline" 
              className="border-gold/30 text-gold hover:bg-gold/10"
            >
              <a href={getLoginUrl()}>Login</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <Badge className="bg-gold/20 text-gold border-gold/30 text-sm px-4 py-1">
              <Sparkles className="h-4 w-4 mr-2 inline" />
              AI-Powered Revenue Engine
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Turn Local Businesses<br />
              Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-yellow-400 to-gold">$5K Paychecks</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto">
              Find businesses with terrible websites, prove it with AI audits, and sell them new ones for $3k-$8k per deal. Everything automated.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                asChild
                size="lg"
                className="text-xl px-12 py-8 bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-600 hover:to-gold text-black font-bold"
              >
                <Link href="/command-center">
                  Start Free Audit
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Link>
              </Button>
              
              <Button 
                asChild
                size="lg"
                variant="outline"
                className="text-xl px-12 py-8 border-white/20 hover:bg-white/5"
              >
                <Link href="/command-center">
                  See Demo Dashboard
                </Link>
              </Button>
            </div>


          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 px-4 bg-gradient-to-r from-gold/10 via-yellow-600/10 to-gold/10">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-black/50 border-gold/30 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-gold">Revenue Calculator</CardTitle>
              <CardDescription className="text-lg">See how much you can make</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm text-white/70 mb-2 block">
                  How many leads can you find per week?
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={leadsFound}
                  onChange={(e) => setLeadsFound(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
                />
                <div className="flex justify-between text-sm text-white/50 mt-2">
                  <span>5 leads</span>
                  <span className="text-gold font-bold text-lg">{leadsFound} leads</span>
                  <span>50 leads</span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-3xl font-bold text-gold">{leadsFound}</div>
                  <div className="text-sm text-white/60">Leads Found</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-3xl font-bold text-green-400">{Math.round(leadsFound * 0.3)}</div>
                  <div className="text-sm text-white/60">Deals Closed (30%)</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-gold/20 to-yellow-600/20 rounded-lg border border-gold/30">
                  <div className="text-3xl font-bold text-gold">${(potentialRevenue * 0.3).toLocaleString()}</div>
                  <div className="text-sm text-white/80">Monthly Revenue</div>
                </div>
              </div>

              <p className="text-center text-white/60 text-sm">
                Based on industry average 30% close rate and $5k average deal size
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-white/70">Four simple steps to your first $5k</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                icon: <Target className="h-12 w-12" />,
                title: "Find Targets",
                description: "Search Google Maps for local businesses. Our scraper finds 50+ leads in 2 minutes."
              },
              {
                step: "2",
                icon: <BarChart3 className="h-12 w-12" />,
                title: "AI Audits",
                description: "AI analyzes their website and generates a professional audit report with a 0-100 score."
              },
              {
                step: "3",
                icon: <DollarSign className="h-12 w-12" />,
                title: "Send Invoice",
                description: "Click 'Send Invoice', choose package ($3k-$8k), and paste the Stripe payment link."
              },
              {
                step: "4",
                icon: <Zap className="h-12 w-12" />,
                title: "Get Paid",
                description: "Webhook automatically updates status when they pay. Track everything in your dashboard."
              }
            ].map((item) => (
              <Card key={item.step} className="bg-gradient-to-b from-white/5 to-white/0 border-white/10 hover:border-gold/30 transition-all">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 text-gold">
                    {item.icon}
                  </div>
                  <div className="text-sm font-mono text-gold">STEP {item.step}</div>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="text-white/60">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">See It In Action</h2>
            <p className="text-xl text-white/70">Watch how to close your first $5K deal in 90 seconds</p>
          </div>
          
          <div className="relative rounded-xl overflow-hidden border-2 border-gold/30 shadow-2xl">
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold/20 text-gold">
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
                <p className="text-white/80 font-mono text-sm">
                  📹 Demo video coming soon
                </p>
                <p className="text-white/50 text-xs max-w-md mx-auto px-4">
                  Record your demo using the DEMO_VIDEO_PRODUCTION_GUIDE.md<br/>
                  Then replace this placeholder with your Loom embed code
                </p>
              </div>
              {/* Replace the above placeholder with your Loom iframe:
              <iframe
                src="YOUR_LOOM_EMBED_URL"
                frameBorder="0"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
              */}
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-white/60 text-sm">
              🎥 90-second demo • No sound required • Watch at 2x speed
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Pricing Packages</h2>
            <p className="text-xl text-white/70">Choose the right package for your clients</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Basic",
                price: "$3,000",
                description: "Perfect for small businesses",
                features: [
                  "Single-page website",
                  "Mobile responsive",
                  "Basic SEO setup",
                  "Contact form",
                  "2-week delivery",
                  "1 month support"
                ],
                badge: null
              },
              {
                name: "Standard",
                price: "$5,000",
                description: "Most popular choice",
                features: [
                  "Multi-page website (up to 5 pages)",
                  "Mobile responsive",
                  "Advanced SEO",
                  "Contact form + integrations",
                  "1-week delivery",
                  "3 months support",
                  "Google Analytics setup"
                ],
                badge: "MOST POPULAR"
              },
              {
                name: "Premium",
                price: "$8,000",
                description: "Full-service package",
                features: [
                  "Multi-page website (unlimited)",
                  "Mobile responsive",
                  "Advanced SEO + content",
                  "Custom integrations",
                  "3-day delivery",
                  "6 months support",
                  "Google Analytics + ads setup",
                  "Social media integration"
                ],
                badge: "BEST VALUE"
              }
            ].map((pkg) => (
              <Card 
                key={pkg.name} 
                className={`relative ${pkg.badge ? 'border-gold/50 bg-gradient-to-b from-gold/10 to-black' : 'bg-white/5 border-white/10'}`}
              >
                {pkg.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gold text-black font-bold px-4 py-1">
                      {pkg.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8 pt-8">
                  <CardTitle className="text-2xl mb-2">{pkg.name}</CardTitle>
                  <div className="text-5xl font-bold text-gold mb-2">{pkg.price}</div>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                        <span className="text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-center text-white/60 mt-12">
            💡 <strong className="text-white">Pro tip:</strong> Start with Standard package for most clients. Upsell to Premium for established businesses with high traffic.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-r from-gold/20 via-yellow-600/20 to-gold/20 border-gold/30">
            <CardContent className="text-center py-16 space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">
                Ready to Start Making Money?
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto">
                Get instant access to the dashboard. Run your first audit in 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  asChild
                  size="lg"
                  className="text-xl px-12 py-8 bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-600 hover:to-gold text-black font-bold"
                >
                <Link href="/command-center">
                  Get Dashboard Access
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Link>
                </Button>
              </div>
              <p className="text-sm text-white/60">
                ✨ First audit is FREE • No credit card required • Start earning today
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-br from-gold to-yellow-600 rounded-sm"></div>
              <span className="font-serif text-xl italic tracking-wide text-gold">Velvet Alchemy</span>
            </div>
            <div className="text-white/60 text-sm">
              © 2026 Velvet Alchemy. Turn websites into revenue.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
