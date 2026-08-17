import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperatorShell, SmirkReceiverPill } from "@/components/OperatorShell";
import { trpc } from "@/lib/trpc";
import { getSmirkLifecycleCounts, isReadyForSmirkReview } from "@shared/smirkLifecycle";
import { evaluateSmirkQualification } from "@shared/smirkQualification";
import { CheckCircle2, ChevronRight, CircleAlert, Filter, Loader2, PhoneCall, Radio, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type QueueFilter = "ready" | "queued" | "outcomes" | "all";

const filterLabels: Record<QueueFilter, string> = {
  ready: "Ready for review",
  queued: "In SMIRK queue",
  outcomes: "Outcomes received",
  all: "All lifecycle states",
};

function statusPresentation(status: string, outcome: string | null) {
  if (outcome) return { label: outcome.replace(/_/g, " "), className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200" };
  if (status === "smirk_queued") return { label: "Queued", className: "border-violet-400/20 bg-violet-400/10 text-violet-200" };
  if (status === "smirk_contacted") return { label: "Contacted", className: "border-blue-400/20 bg-blue-400/10 text-blue-200" };
  if (status === "audited") return { label: "Audited", className: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300" };
  return { label: status.replace(/_/g, " "), className: "border-white/10 bg-white/[0.04] text-slate-300" };
}

export default function SmirkQueue() {
  const [filter, setFilter] = useState<QueueFilter>("ready");
  const [query, setQuery] = useState("");
  const leadsQuery = trpc.leads.list.useQuery();
  const smirkQuery = trpc.leads.smirkStats.useQuery(undefined, { refetchInterval: 30_000 });
  const leads = leadsQuery.data ?? [];

  const counts = useMemo(() => getSmirkLifecycleCounts(leads), [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads.filter(lead => {
      const lifecycleMatch = filter === "all"
        || (filter === "ready" && isReadyForSmirkReview(lead))
        || (filter === "queued" && lead.status === "smirk_queued")
        || (filter === "outcomes" && Boolean(lead.smirkCallOutcome));
      const searchMatch = !normalizedQuery || [lead.companyName, lead.phone, lead.city, lead.category]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalizedQuery));
      return lifecycleMatch && searchMatch;
    }).sort((a, b) => {
      const aPriority = a.status === "smirk_queued" ? 2 : a.smirkCallOutcome ? 1 : 3;
      const bPriority = b.status === "smirk_queued" ? 2 : b.smirkCallOutcome ? 1 : 3;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (a.prestigeScore ?? 999) - (b.prestigeScore ?? 999);
    });
  }, [filter, leads, query]);

  return (
    <OperatorShell
      eyebrow="SMIRK WORKSPACE"
      title="Live Queue"
      description="Only leads that pass the explicit audit, operating-status, phone, demand, and opportunity gates appear as ready. Explicit operator approval still happens on the individual lead before SMIRK receives a brief."
      actions={<Link href="/scraper"><Button size="sm" className="gap-2 bg-violet-500 text-white hover:bg-violet-400"><Search className="h-3.5 w-3.5" /> Hunt leads</Button></Link>}
    >
      <section className="mb-6 grid gap-3 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
        <div className="rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.12] to-cyan-400/[0.04] p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.15em] text-violet-200">RECEIVER STATE</p><h2 className="mt-2 text-xl font-semibold text-white">{smirkQuery.data?.diagnostics.state === "reachable" ? "SMIRK route is reachable" : "Handoff is blocked"}</h2></div><Radio className="h-5 w-5 text-violet-200" /></div>
          <p className="mt-3 max-w-lg text-sm leading-5 text-slate-300">{smirkQuery.data?.diagnostics.message ?? "Checking the current connection state."}</p>
          <div className="mt-4"><SmirkReceiverPill state={smirkQuery.data?.diagnostics.state} /></div>
        </div>
        {[
          { label: "Qualified", value: counts.ready, icon: CircleAlert, color: "text-emerald-300" },
          { label: "Queued", value: counts.queued, icon: PhoneCall, color: "text-violet-200" },
          { label: "Outcomes", value: counts.outcomes, icon: CheckCircle2, color: "text-cyan-200" },
        ].map(stat => {
          const Icon = stat.icon;
          return <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><Icon className={`h-4 w-4 ${stat.color}`} /><p className="mt-5 text-3xl font-semibold text-white">{stat.value}</p><p className="mt-1 text-xs text-slate-500">{stat.label}</p></div>;
        })}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#0d0f17]/80 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Queue filter">
            {(Object.keys(filterLabels) as QueueFilter[]).map(option => (
              <button key={option} onClick={() => setFilter(option)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === option ? "bg-white/[0.1] text-white" : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"}`}>
                {filterLabels[option]}{option !== "all" && <span className="ml-1.5 text-slate-600">{counts[option]}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-full md:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search business, city, phone" className="h-9 border-white/[0.08] bg-black/20 pl-9 text-xs placeholder:text-slate-600" /></div>
        </div>
        {leadsQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-violet-300" /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-6 text-center"><div><Filter className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-3 text-sm font-medium text-slate-300">No leads in this queue state</p><p className="mt-1 text-xs text-slate-600">A lead is ready only after it passes the auditable SMIRK qualification gate.</p></div></div>
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {filteredLeads.map(lead => {
              const status = statusPresentation(lead.status, lead.smirkCallOutcome);
              const qualification = evaluateSmirkQualification(lead);
              return (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="group block p-4 transition-colors hover:bg-white/[0.025] md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-slate-100">{lead.companyName}</h3><Badge className={`border text-[10px] font-medium capitalize ${status.className}`}>{status.label}</Badge>{qualification.eligible ? <Badge className="border border-emerald-400/20 bg-emerald-400/[0.08] text-[10px] font-medium text-emerald-200">Qualified</Badge> : <Badge className="border border-rose-400/20 bg-rose-400/[0.08] text-[10px] font-medium text-rose-200">Blocked · {qualification.blockers[0]?.label ?? "Evidence incomplete"}</Badge>}</div><p className="mt-1.5 truncate text-xs text-slate-500">{[lead.city, lead.state, lead.category, lead.phone].filter(Boolean).join(" · ") || "No location or contact detail"}</p></div>
                    <div className="flex items-center gap-6 text-xs"><div><p className="text-slate-600">AUDIT SCORE</p><p className="mt-1 font-semibold text-slate-300">{lead.prestigeScore ?? "—"}</p></div><div><p className="text-slate-600">HANDOFF</p><p className="mt-1 font-semibold text-slate-300">{lead.smirkHandoffAt ? new Date(lead.smirkHandoffAt).toLocaleDateString() : "Not sent"}</p></div><ChevronRight className="h-4 w-4 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-300" /></div>
                  </div>
                  {lead.smirkCallSummary && <p className="mt-3 line-clamp-2 border-l border-cyan-300/30 pl-3 text-xs leading-5 text-slate-400">{lead.smirkCallSummary}</p>}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </OperatorShell>
  );
}
