import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const EVENTS = [
  "LEAD_ACQUIRED: ID_8842 [LUXURY_REAL_ESTATE]",
  "AUDIT_COMPLETE: VISUAL_DEBT_SCORE 82/100",
  "ASSET_SYNTHESIS: GENERATING_HERO_IMAGE...",
  "OUTREACH_SENT: CAMPAIGN_ALPHA_V2",
  "REVENUE_EVENT: $12,500 [PENDING]",
  "SYSTEM_OPTIMIZATION: REBALANCING_NODES",
  "MEMORY_HYDRATION: NEW_PATTERN_DETECTED",
  "GOVERNANCE: DOMAIN_REPUTATION_CHECK [PASS]",
  "THE_CHARMER: DRAFTING_SEQUENCE_04",
  "LEAD_QUALIFIED: NET_WORTH > $50M"
];

export function LiveTicker() {
  const [activeEvent, setActiveEvent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEvent(prev => (prev + 1) % EVENTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 h-8 flex items-center overflow-hidden z-40">
      <div className="container flex items-center gap-4">
        <div className="flex items-center gap-2 px-2 bg-white/5 h-full border-r border-white/10">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider">LIVE_FEED</span>
        </div>
        
        <div className="flex-1 font-mono text-xs text-[#00FF41] overflow-hidden relative h-full flex items-center">
          {EVENTS.map((event, i) => (
            <div
              key={i}
              className={cn(
                "absolute inset-0 flex items-center transition-all duration-500 transform",
                i === activeEvent ? "translate-y-0 opacity-100" : 
                i < activeEvent ? "-translate-y-full opacity-0" : "translate-y-full opacity-0"
              )}
            >
              <span className="mr-4 text-white/50">[{new Date().toLocaleTimeString()}]</span>
              {event}
            </div>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
          <span>CPU: 12%</span>
          <span>MEM: 4.2GB</span>
          <span>NET: 1.2GB/s</span>
        </div>
      </div>
    </div>
  );
}
