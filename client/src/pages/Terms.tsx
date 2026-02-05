import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif italic text-4xl text-gold">Terms of Yield</h1>
          <p className="font-mono text-xs text-white/50 tracking-wide">Last updated: 2026-02-04</p>
        </div>

        <div className="space-y-6 font-mono text-sm text-white/70 leading-relaxed">
          <p>
            The Yield Diagnostic is an informational service. It is not legal, tax, or financial advice.
          </p>
          <p>
            Delivery timelines are best-effort. If you purchase a diagnostic, we will use reasonable efforts
            to deliver within the stated window.
          </p>
          <p>
            Questions: <span className="text-white">madeinreno775@gmail.com</span>.
          </p>
        </div>

        <div className="pt-6">
          <Link href="/" className="font-mono text-xs text-gold underline">Return to Velvet Alchemy</Link>
        </div>
      </div>
    </div>
  );
}
