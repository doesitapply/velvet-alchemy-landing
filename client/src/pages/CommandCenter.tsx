import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperatorShell, SmirkReceiverPill } from "@/components/OperatorShell";
import { trpc } from "@/lib/trpc";
import { getSmirkLifecycleCounts, isReadyForSmirkReview } from "@shared/smirkLifecycle";
import { Activity, ArrowRight, CheckCircle2, ChevronRight, CircleAlert, Crosshair, PhoneCall, Radio, Search, Settings2, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";

function StatusDot({ color }: { color: "violet" | "emerald" | "cyan" | "amber" }) {
  const colors = { violet: "bg-violet-300", emerald: "bg-emerald-300", cyan: "bg-cyan-300", amber: "bg-amber-300" };
  return <span className={`h-1.5 w-1.5 rounded-full ${colors[color]}`} />;
}

export default function CommandCenter() {
  const leadsQuery = trpc.leads.list.useQuery();
  const smirkQuery = trpc.leads.smirkStats.useQuery(undefined, { refetchInterval: 30_000, refetchOnWindowFocus: true });
  const leads = leadsQuery.data ?? [];
  const smirk = smirkQuery.data;

  const lifecycle = useMemo(() => getSmirkLifecycleCounts(leads), [leads]);

  const latestCandidates = useMemo(() => leads
    .filter(isReadyForSmirkReview)
    .sort((a, b) => (a.prestigeScore ?? 999) - (b.prestigeScore ?? 999))
    .slice(0, 4), [leads]);

  return (
    <OperatorShell
      eyebrow="PRIVATE OPERATOR CONSOLE"
      title="Operations"
      description="Velvet supplies the evidence and qualification layer. SMIRK receives only deliberately approved call briefs, while this console keeps the handoff and outcome record visible."
      actions={<Link href="/smirk-queue"><Button size="sm" className="gap-2 bg-violet-500 text-white hover:bg-violet-400"><Radio className="h-3.5 w-3.5" /> Open live queue</Button></Link>}
    >
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.15] via-[#121322] to-cyan-400/[0.045] p-5 md:p-7">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start"><div><div className="flex items-center gap-2"><StatusDot color="violet" /><p className="text-[11px] font-semibold tracking-[0.18em] text-violet-200">SMIRK HANDOFF LAYER</p></div><h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">Operate the lead-to-call loop without losing the evidence.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Review real audit evidence, approve a specific target, and capture the post-call signal. No automatic SMS, email, or call submission occurs from this console.</p></div><div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 md:min-w-48"><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-500">RECEIVER</p><div className="mt-3"><SmirkReceiverPill state={smirk?.diagnostics.state} /></div><p className="mt-3 text-xs leading-5 text-slate-400">{smirk?.diagnostics.message ?? "Checking connection state…"}</p></div></div>
          <div className="mt-7 flex flex-wrap gap-2"><Link href="/scraper"><Button variant="outline" className="border-violet-300/30 bg-white/[0.05] text-white hover:bg-white/[0.1]"><Search className="mr-2 h-4 w-4 text-violet-200" /> Hunt candidates</Button></Link><Link href="/smirk-queue"><Button variant="ghost" className="text-slate-300 hover:bg-white/[0.06] hover:text-white">Review live queue <ArrowRight className="ml-2 h-4 w-4" /></Button></Link></div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0f17]/85 p-5"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">OUTCOME SIGNALS</p><h2 className="mt-1 text-lg font-semibold text-white">Recorded by SMIRK</h2></div><Activity className="h-4 w-4 text-cyan-300" /></div><div className="mt-6 grid grid-cols-2 gap-3">{[
          { label: "Queued", value: smirk?.queued ?? 0, color: "text-violet-200" },
          { label: "Contacted", value: smirk?.contacted ?? 0, color: "text-blue-200" },
          { label: "Interested", value: smirk?.interested ?? 0, color: "text-emerald-200" },
          { label: "Booked", value: smirk?.booked ?? 0, color: "text-amber-200" },
        ].map(stat => <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p><p className="mt-1 text-xs text-slate-500">{stat.label}</p></div>)}</div><Link href="/smirk-queue" className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-xs text-slate-400 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/[0.04] hover:text-cyan-100">Open outcome queue <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-4">
        {[
          { label: "Audited", value: lifecycle.audited, helper: "Evidence captured", icon: Sparkles, color: "text-cyan-200" },
          { label: "Ready", value: lifecycle.ready, helper: "Needs review", icon: CircleAlert, color: "text-emerald-200" },
          { label: "Queued", value: lifecycle.queued, helper: "Accepted by SMIRK", icon: PhoneCall, color: "text-violet-200" },
          { label: "Outcomes", value: lifecycle.outcomes, helper: "Signal returned", icon: CheckCircle2, color: "text-amber-200" },
        ].map(metric => { const Icon = metric.icon; return <div key={metric.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><Icon className={`h-4 w-4 ${metric.color}`} /><p className="mt-5 text-3xl font-semibold text-white">{metric.value}</p><p className="mt-1 text-sm text-slate-300">{metric.label}</p><p className="mt-0.5 text-xs text-slate-600">{metric.helper}</p></div>; })}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0f17]/80"><div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">NEXT FOR REVIEW</p><h2 className="mt-1 text-lg font-semibold text-white">Qualified candidates</h2></div><Link href="/smirk-queue"><Button variant="ghost" size="sm" className="text-xs text-violet-200 hover:bg-violet-300/[0.08] hover:text-violet-100">See full queue <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link></div>
          <div className="divide-y divide-white/[0.055]">{leadsQuery.isLoading ? <div className="p-8 text-center text-sm text-slate-600">Loading live lead state…</div> : latestCandidates.length === 0 ? <div className="p-8 text-center"><Crosshair className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-3 text-sm text-slate-400">No audit-qualified leads with a phone number yet.</p><Link href="/scraper" className="mt-3 inline-block text-xs text-violet-300 hover:text-violet-200">Start a hunt</Link></div> : latestCandidates.map(lead => <Link key={lead.id} href={`/leads/${lead.id}`} className="group flex items-center gap-4 p-4 transition-colors hover:bg-white/[0.025]"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/[0.08] text-emerald-200"><Crosshair className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{lead.companyName}</p><p className="mt-1 truncate text-xs text-slate-600">{[lead.city, lead.state, lead.phone].filter(Boolean).join(" · ")}</p></div><div className="hidden text-right sm:block"><p className="text-[10px] tracking-wide text-slate-600">AUDIT SCORE</p><p className="mt-1 text-sm font-semibold text-slate-300">{lead.prestigeScore ?? "—"}</p></div><ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-violet-300" /></Link>)}</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0f17]/80 p-5"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">OPERATOR CONTROLS</p><h2 className="mt-1 text-lg font-semibold text-white">Keep the boundary tight</h2></div><Settings2 className="h-4 w-4 text-slate-500" /></div><div className="mt-5 space-y-3 text-sm"><Link href="/api-keys" className="group flex items-start gap-3 rounded-xl border border-white/[0.06] p-3 transition-colors hover:border-violet-300/20 hover:bg-violet-300/[0.04]"><div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-violet-300/[0.1] text-violet-200"><Radio className="h-3.5 w-3.5" /></div><div><p className="font-medium text-slate-200">SMIRK connection</p><p className="mt-1 text-xs leading-5 text-slate-500">Keys, callback contract, and receiver diagnostics.</p></div></Link><Link href="/governor" className="group flex items-start gap-3 rounded-xl border border-white/[0.06] p-3 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"><div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-cyan-300/[0.1] text-cyan-200"><Settings2 className="h-3.5 w-3.5" /></div><div><p className="font-medium text-slate-200">Safety controls</p><p className="mt-1 text-xs leading-5 text-slate-500">Rate limits, cost guardrails, and the global kill switch.</p></div></Link></div></div>
      </section>
    </OperatorShell>
  );
}
