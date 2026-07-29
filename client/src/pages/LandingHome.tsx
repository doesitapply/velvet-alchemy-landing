import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";

/**
 * Auth gate — the only public-facing page.
 * Authenticated users are redirected immediately to /command-center.
 * Unauthenticated users see a minimal login prompt.
 */
export default function LandingHome() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/command-center");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }}
      />
      <div className="relative z-10 flex flex-col items-center gap-10 px-6 text-center">
        <div className="space-y-2">
          <h1 className="font-serif italic text-4xl tracking-wide text-white">
            Velvet Alchemy
          </h1>
          <p className="font-mono text-xs text-white/30 tracking-[0.2em] uppercase">
            Signal Intelligence · Operator Access Only
          </p>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <a
          href={getLoginUrl()}
          className="inline-flex items-center gap-3 px-8 py-3 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white font-mono text-sm tracking-widest uppercase transition-all duration-200"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Enter
        </a>
        <p className="font-mono text-[10px] text-white/15 tracking-widest uppercase mt-4">
          System Online
        </p>
      </div>
    </div>
  );
}
