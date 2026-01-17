import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Terminal as TerminalIcon, ShieldCheck, Zap, Database, Globe, Lock } from "lucide-react";
import { Terminal } from "@/components/Terminal";
import { LiveTicker } from "@/components/LiveTicker";
import { RequestAccessDialog } from "@/components/RequestAccessDialog";

export default function Home() {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden pb-8">
      
      <Terminal isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
      <RequestAccessDialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen} />
      <LiveTicker />

      {/* Navigation / Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-sm border border-white/20"></div>
            <span className="font-serif text-xl italic tracking-wide text-gold">Velvet Alchemy</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-mono text-muted-foreground">
            <a href="#manifest" className="hover:text-foreground transition-colors">MANIFEST</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">ARCHITECTURE</a>
            <a href="#status" className="hover:text-foreground transition-colors">SYSTEM STATUS</a>
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-block text-xs font-mono text-terminal animate-pulse">● SYSTEM ONLINE</span>
            <Button 
              variant="outline" 
              className="font-mono text-xs border-white/20 hover:bg-white/5 hover:text-gold rounded-none h-9"
              onClick={() => setIsTerminalOpen(true)}
            >
              ACCESS TERMINAL
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        
        {/* Hero Section: The Gravity Well */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden border-b border-white/10">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src="/images/gravity-well-hero.jpg" 
              alt="Gravity Well Visualization" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          </div>

          <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-white/10 bg-white/5 backdrop-blur-sm rounded-none">
                <span className="w-2 h-2 bg-terminal rounded-full animate-pulse"></span>
                <span className="text-xs font-mono tracking-widest text-muted-foreground">REVENUE ENGINE V2.0 ACTIVE</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif italic leading-[0.9] text-white">
                The Art of <br/>
                <span className="text-gold">Automated Seduction</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl font-mono leading-relaxed border-l-2 border-gold/50 pl-6">
                An autonomous, multi-agent system designed to audit, synthesize, and close high-net-worth leads without human intervention.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  size="lg" 
                  className="rounded-none bg-gold text-black hover:bg-white font-mono text-sm h-14 px-8 border border-transparent"
                  onClick={() => setIsAccessDialogOpen(true)}
                >
                  INITIATE SEQUENCE <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="rounded-none border-white/20 text-white hover:bg-white/5 font-mono text-sm h-14 px-8"
                  onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  VIEW ARCHITECTURE
                </Button>
              </div>
            </div>

            {/* Right Side: Simulated Terminal/Dashboard Preview */}
            <div className="hidden lg:block relative">
              <div className="glass-panel p-1 rounded-none border border-white/10 transform rotate-y-12 hover:rotate-0 transition-transform duration-700 perspective-1000">
                <img 
                  src="/images/dashboard-ui-mockup.jpg" 
                  alt="Velvet Alchemy Dashboard" 
                  className="w-full h-auto border border-white/5 opacity-90"
                />
                {/* Floating Data Points */}
                <div className="absolute -left-12 top-1/4 glass-panel p-4 border-l-4 border-terminal max-w-[200px]">
                  <div className="text-xs font-mono text-muted-foreground mb-1">LEAD VELOCITY</div>
                  <div className="text-2xl font-mono text-white">84.3% <span className="text-terminal text-sm">▲</span></div>
                </div>
                <div className="absolute -right-8 bottom-1/3 glass-panel p-4 border-l-4 border-gold max-w-[200px]">
                  <div className="text-xs font-mono text-muted-foreground mb-1">REVENUE PROJECTED</div>
                  <div className="text-2xl font-mono text-gold">$1.2M</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Manifest / Philosophy Section */}
        <section id="manifest" className="py-24 border-b border-white/10 bg-black relative">
          <div className="container">
            <div className="grid md:grid-cols-12 gap-12">
              <div className="md:col-span-4">
                <h2 className="text-4xl font-serif italic text-white mb-6">The Manifest</h2>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  We do not build tools. We build organisms. Velvet Alchemy is a living system that feeds on data and excretes revenue. It operates in the shadows, ensuring your brand is the only one that matters.
                </p>
              </div>
              <div className="md:col-span-8 grid sm:grid-cols-2 gap-6">
                {[
                  { title: "The Curator", icon: Database, desc: "Scours the void for high-value targets. Audits visual debt instantly." },
                  { title: "The Visionary", icon: Zap, desc: "Synthesizes bespoke visual assets. Shows them what they could be." },
                  { title: "The Charmer", icon: TerminalIcon, desc: "Crafts seductive, high-status outreach. Never begs, only offers." },
                  { title: "The Governor", icon: ShieldCheck, desc: "Ensures domain safety and reputation. The immune system." }
                ].map((agent, i) => (
                  <Card key={i} className="bg-white/5 border-white/10 rounded-none p-6 hover:bg-white/10 transition-colors group">
                    <agent.icon className="h-8 w-8 text-gold mb-4 group-hover:text-white transition-colors" />
                    <h3 className="text-xl font-serif italic text-white mb-2">{agent.title}</h3>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">{agent.desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Architecture / Tech Stack */}
        <section id="architecture" className="py-24 border-b border-white/10 bg-[#080808]">
          <div className="container">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
              <div>
                <div className="text-terminal font-mono text-xs mb-2">SYSTEM ARCHITECTURE</div>
                <h2 className="text-4xl md:text-5xl font-serif italic text-white">Built for <span className="text-gold">War</span></h2>
              </div>
              <div className="font-mono text-xs text-muted-foreground max-w-md text-right">
                STACK_VERSION: 2.0.4<br/>
                INFRASTRUCTURE: DISTRIBUTED<br/>
                LATENCY: &lt;40ms
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10">
              {[
                { label: "CORE", val: "Next.js 15" },
                { label: "DATABASE", val: "Supabase" },
                { label: "MEMORY", val: "Pinecone" },
                { label: "AUTH", val: "Clerk" },
                { label: "DEPLOY", val: "Vercel / Fly" },
                { label: "PAYMENTS", val: "Stripe Connect" },
                { label: "EMAIL", val: "Instantly.ai" },
                { label: "VISION", val: "GPT-4o" }
              ].map((item, i) => (
                <div key={i} className="bg-background p-8 hover:bg-white/5 transition-colors group">
                  <div className="text-xs font-mono text-muted-foreground mb-2 group-hover:text-terminal transition-colors">{item.label}</div>
                  <div className="text-lg font-serif italic text-white">{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Status / Footer */}
        <section id="status" className="py-24 bg-black relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/images/gravity-well-hero.jpg')] opacity-10 bg-cover bg-center mix-blend-screen"></div>
          <div className="container relative z-10 text-center">
            <div className="inline-block mb-8">
              <div className="h-16 w-16 mx-auto bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-full border border-gold/30 shadow-[0_0_30px_rgba(247,231,206,0.2)]"></div>
            </div>
            <h2 className="text-5xl md:text-7xl font-serif italic text-white mb-8">Ready to <span className="text-gold">Ascend?</span></h2>
            <p className="font-mono text-muted-foreground mb-12 max-w-lg mx-auto">
              The system is currently accepting a limited number of pilot workspaces. Access is granted by invitation only.
            </p>
            
            <div className="flex flex-col items-center gap-4">
              <Button 
                size="lg" 
                className="rounded-none bg-white text-black hover:bg-gold font-mono text-sm h-14 px-12 min-w-[200px]"
                onClick={() => setIsAccessDialogOpen(true)}
              >
                REQUEST ACCESS
              </Button>
              <div className="flex items-center gap-6 mt-12 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-2"><Lock className="h-3 w-3" /> ENCRYPTED</span>
                <span className="flex items-center gap-2"><Globe className="h-3 w-3" /> GLOBAL NODES</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> AUDITED</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-white/10 bg-black py-8">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs font-mono text-muted-foreground">
            © 2026 VELVET ALCHEMY SYSTEMS. ALL RIGHTS RESERVED.
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            SYSTEM_ID: VA-8842-X
          </div>
        </div>
      </footer>
    </div>
  );
}
