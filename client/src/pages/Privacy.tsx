import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif italic text-4xl text-gold">Privacy Protocol</h1>
          <p className="font-mono text-xs text-white/50 tracking-wide">Last updated: 2026-02-04</p>
        </div>

        <div className="space-y-6 font-mono text-sm text-white/70 leading-relaxed">
          <p>
            Velvet Alchemy collects the minimum information required to deliver a Yield Diagnostic.
            This typically includes: your entity name, your website URL, and a delivery email.
          </p>
          <p>
            We may process your website content (including screenshots) to generate a diagnostic report.
            We do not sell your personal information.
          </p>
          <p>
            For questions or deletion requests, contact: <span className="text-white">madeinreno775@gmail.com</span>.
          </p>
        </div>

        <div className="pt-6">
          <Link href="/" className="font-mono text-xs text-gold underline">Return to Velvet Alchemy</Link>
        </div>
      </div>
    </div>
  );
}
