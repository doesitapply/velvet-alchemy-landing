import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getSmirkReceiverPresentation } from "@shared/smirkReceiverPresentation";
import {
  Activity,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Gauge,
  KeyRound,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Search,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";

type OperatorShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

const navigation = [
  { path: "/command-center", label: "Operations", icon: Gauge },
  { path: "/smirk-queue", label: "Live Queue", icon: Radio },
  { path: "/leads", label: "Lead Intelligence", icon: Crosshair },
  { path: "/scraper", label: "Hunt", icon: Search },
];

const systemNavigation = [
  { path: "/api-keys", label: "SMIRK Connection", icon: KeyRound },
  { path: "/governor", label: "Controls", icon: ShieldCheck },
  { path: "/export", label: "Export", icon: ListChecks },
];

const SMIRK_CONSOLE_URL = "https://smirkcalls.com";

function ReceiverPill({ state }: { state?: string }) {
  const presentation = getSmirkReceiverPresentation(state);
  const isReachable = presentation.tone === "reachable";
  const isVerifying = presentation.tone === "verifying";
  return (
    <Badge
      className={isReachable
        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10"
        : isVerifying
          ? "border-slate-400/20 bg-slate-400/10 text-slate-300 hover:bg-slate-400/10"
          : "border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10"}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isReachable ? "bg-emerald-300" : isVerifying ? "bg-slate-300 animate-pulse" : "bg-amber-300"}`} />
      {presentation.label}
    </Badge>
  );
}

export function OperatorShell({ children, eyebrow, title, description, actions }: OperatorShellProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const smirkStatsQuery = trpc.leads.smirkStats.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const smirkStats = smirkStatsQuery.data;
  const isReachable = smirkStats?.diagnostics.state === "reachable";
  const isVerifying = smirkStatsQuery.isLoading || !smirkStats;

  const navigate = (path: string) => setLocation(path);

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 selection:bg-violet-400/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(124,58,237,0.14),transparent_25rem),radial-gradient(circle_at_86%_14%,rgba(14,165,233,0.09),transparent_26rem)]" />
      <div className="relative flex min-h-screen">
        <aside className={`${collapsed ? "w-[76px]" : "w-[276px]"} sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.08] bg-[#0c0d13]/95 px-3 py-4 transition-[width] duration-200 lg:flex`}>
          <div className="mb-7 flex h-10 items-center justify-between px-2">
            <button onClick={() => navigate("/command-center")} className="flex min-w-0 items-center gap-3 text-left" aria-label="Open operations console">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet-300/25 bg-violet-400/10 text-violet-200 shadow-[0_0_24px_rgba(139,92,246,0.12)]">
                <Waves className="h-4 w-4" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-[0.16em] text-white">VELVET</p>
                  <p className="-mt-0.5 text-[10px] font-medium tracking-[0.22em] text-violet-300">SMIRK OPS</p>
                </div>
              )}
            </button>
            {!collapsed && <span className="rounded border border-white/[0.09] px-1.5 py-0.5 text-[9px] font-medium tracking-[0.14em] text-slate-500">PRIVATE</span>}
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500">WORKFLOW</p>}
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = location === item.path || (item.path === "/leads" && location.startsWith("/leads/"));
              return (
                <button key={item.path} onClick={() => navigate(item.path)} title={collapsed ? item.label : undefined} className={`group flex h-11 w-full items-center rounded-xl px-3 text-left transition-colors ${active ? "bg-violet-400/12 text-white" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                  {!collapsed && <span className="ml-3 flex-1 text-sm font-medium">{item.label}</span>}
                  {!collapsed && active && <ChevronRight className="h-3.5 w-3.5 text-violet-300" />}
                </button>
              );
            })}
          </nav>

          <Separator className="my-5 bg-white/[0.08]" />

          <nav className="space-y-1" aria-label="System navigation">
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500">SYSTEM</p>}
            {systemNavigation.map((item) => {
              const Icon = item.icon;
              const active = location === item.path;
              return (
                <button key={item.path} onClick={() => navigate(item.path)} title={collapsed ? item.label : undefined} className={`group flex h-10 w-full items-center rounded-xl px-3 text-left transition-colors ${active ? "bg-white/[0.07] text-white" : "text-slate-500 hover:bg-white/[0.045] hover:text-slate-200"}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cyan-300" : "group-hover:text-slate-300"}`} />
                  {!collapsed && <span className="ml-3 flex-1 text-sm">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <a href={SMIRK_CONSOLE_URL} target="_blank" rel="noreferrer" className="flex h-10 w-full items-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-3 text-cyan-100 transition-colors hover:border-cyan-300/30 hover:bg-cyan-300/[0.08]" title="Open SMIRK control console">
              <Radio className="h-3.5 w-3.5" />
              {!collapsed && <><span className="ml-3 flex-1 text-xs font-medium">Open SMIRK</span><ExternalLink className="h-3 w-3 text-cyan-300" /></>}
            </a>
            <button onClick={() => setCollapsed(value => !value)} className="flex h-9 w-full items-center rounded-lg px-3 text-slate-500 transition-colors hover:bg-white/[0.045] hover:text-slate-200" title={collapsed ? "Expand navigation" : "Collapse navigation"}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span className="ml-3 text-xs">Collapse</span></>}
            </button>
            <div className={`rounded-xl border ${isReachable ? "border-emerald-400/15 bg-emerald-400/[0.045]" : isVerifying ? "border-slate-400/15 bg-slate-400/[0.035]" : "border-amber-400/15 bg-amber-400/[0.045]"} p-3`}>
              <div className="flex items-center gap-2">
                <Activity className={`h-3.5 w-3.5 ${isReachable ? "text-emerald-300" : isVerifying ? "text-slate-300" : "text-amber-300"}`} />
                {!collapsed && <span className="text-xs font-medium text-slate-200">SMIRK Receiver</span>}
              </div>
              {!collapsed && <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{smirkStats?.diagnostics.message ?? "Verifying connection…"}</p>}
            </div>
            <div className="flex items-center gap-2 px-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold text-slate-300">{user?.name?.slice(0, 1).toUpperCase() ?? "O"}</div>
              {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-300">{user?.name ?? "Operator"}</p><p className="text-[10px] text-slate-600">{user?.role ?? "private"}</p></div>}
              {!collapsed && <button onClick={logout} className="text-slate-600 transition-colors hover:text-rose-300" title="Sign out"><LogOut className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-white/[0.07] bg-[#08090d]/85 px-5 py-3 backdrop-blur-xl md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => navigate("/command-center")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-300/20 bg-violet-400/10 text-violet-200 lg:hidden"><Waves className="h-4 w-4" /></button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-violet-300">{eyebrow}</p>
                <h1 className="truncate font-sans text-lg font-semibold tracking-tight text-slate-100">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block"><ReceiverPill state={smirkStats?.diagnostics.state} /></div>
              {actions}
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1640px] px-5 py-6 md:px-8 lg:py-8">
            {description && <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>}
            {children}
          </main>
        </section>
      </div>
    </div>
  );
}

export function SmirkReceiverPill({ state }: { state?: string }) {
  return <ReceiverPill state={state} />;
}
