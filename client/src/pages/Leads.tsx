import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperatorShell } from "@/components/OperatorShell";
import { trpc } from "@/lib/trpc";
import { getSmirkLifecycleCounts, isInSmirkLifecycle, isReadyForSmirkReview } from "@shared/smirkLifecycle";
import { ChevronRight, CircleAlert, Filter, Loader2, PhoneCall, Radio, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type LeadFilter = "all" | "pending" | "audited" | "ready" | "smirk";

function leadState(status: string, outcome?: string | null) {
  if (outcome) return { label: outcome.replace(/_/g, " "), tone: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100" };
  if (status === "smirk_queued") return { label: "SMIRK queued", tone: "border-violet-300/20 bg-violet-300/10 text-violet-100" };
  if (status === "smirk_contacted") return { label: "SMIRK contacted", tone: "border-blue-300/20 bg-blue-300/10 text-blue-100" };
  if (status === "audited") return { label: "Audited", tone: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" };
  if (status === "pending") return { label: "Audit pending", tone: "border-amber-300/20 bg-amber-300/10 text-amber-100" };
  return { label: status.replace(/_/g, " "), tone: "border-white/[0.1] bg-white/[0.04] text-slate-300" };
}

export default function Leads() {
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [search, setSearch] = useState("");
  const leadsQuery = trpc.leads.list.useQuery();
  const leads = leadsQuery.data ?? [];

  const counts = useMemo(() => {
    const lifecycle = getSmirkLifecycleCounts(leads);
    return { all: leads.length, pending: leads.filter(lead => lead.status === "pending").length, smirk: leads.filter(isInSmirkLifecycle).length, ...lifecycle };
  }, [leads]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return leads.filter(lead => {
      const filterMatch = filter === "all"
        || (filter === "pending" && lead.status === "pending")
        || (filter === "audited" && lead.status === "audited")
        || (filter === "ready" && isReadyForSmirkReview(lead))
        || (filter === "smirk" && isInSmirkLifecycle(lead));
      const textMatch = !normalized || [lead.companyName, lead.city, lead.state, lead.phone, lead.category, lead.websiteUrl]
        .filter(Boolean).some(value => String(value).toLowerCase().includes(normalized));
      return filterMatch && textMatch;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filter, leads, search]);

  return (
    <OperatorShell
      eyebrow="EVIDENCE LIBRARY"
      title="Lead intelligence"
      description="Every record remains attached to what Velvet observed, what information is missing, and whether it has reached SMIRK. The live queue exposes only audited records with a phone number for operator review."
      actions={<Link href="/smirk-queue"><Button size="sm" className="gap-2 bg-violet-500 text-white hover:bg-violet-400"><Radio className="h-3.5 w-3.5" /> Live queue</Button></Link>}
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { id: "all" as const, label: "All records", value: counts.all, icon: Filter, tone: "text-slate-300" },
          { id: "pending" as const, label: "Audit pending", value: counts.pending, icon: CircleAlert, tone: "text-amber-200" },
          { id: "audited" as const, label: "Evidence ready", value: counts.audited, icon: Sparkles, tone: "text-cyan-200" },
          { id: "ready" as const, label: "Call-review ready", value: counts.ready, icon: PhoneCall, tone: "text-emerald-200" },
          { id: "smirk" as const, label: "SMIRK lifecycle", value: counts.smirk, icon: Radio, tone: "text-violet-200" },
        ].map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-2xl border p-4 text-left transition-colors ${filter === item.id ? "border-violet-300/30 bg-violet-300/[0.08]" : "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05]"}`}><Icon className={`h-4 w-4 ${item.tone}`} /><p className="mt-5 text-2xl font-semibold text-white">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></button>;
        })}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0f17]/80">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">RECORDS</p><p className="mt-1 text-sm text-slate-300">{filtered.length} {filter === "all" ? "record" : `${filter} record`}{filtered.length === 1 ? "" : "s"} shown</p></div><div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><Input value={search} onChange={event => setSearch(event.target.value)} className="h-9 border-white/[0.08] bg-black/20 pl-9 text-xs text-slate-200 placeholder:text-slate-600" placeholder="Search business, location, phone" /></div></div>
        {leadsQuery.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-violet-300" /></div> : filtered.length === 0 ? <div className="grid min-h-72 place-items-center p-6 text-center"><div><Filter className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-3 text-sm font-medium text-slate-300">No matching records</p><p className="mt-1 text-xs text-slate-600">Change the lifecycle filter or start a new hunt.</p><Link href="/scraper" className="mt-4 inline-block text-xs text-violet-300 hover:text-violet-200">Open hunt engine</Link></div></div> : <div className="divide-y divide-white/[0.055]">{filtered.map(lead => {
          const state = leadState(lead.status, lead.smirkCallOutcome);
          return <Link key={lead.id} href={`/leads/${lead.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 transition-colors hover:bg-white/[0.025] md:grid-cols-[minmax(0,1.2fr)_minmax(100px,0.45fr)_minmax(100px,0.4fr)_auto] md:items-center md:gap-6 md:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-200">{lead.companyName}</p><Badge className={`border text-[10px] font-medium capitalize ${state.tone}`}>{state.label}</Badge></div><p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">{[lead.category, [lead.city, lead.state].filter(Boolean).join(", "), lead.phone].filter(Boolean).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</p></div><div className="hidden md:block"><p className="text-[10px] font-semibold tracking-[0.13em] text-slate-600">AUDIT SCORE</p><p className="mt-1 text-sm font-semibold text-slate-300">{lead.prestigeScore ?? "—"}</p></div><div className="hidden md:block"><p className="text-[10px] font-semibold tracking-[0.13em] text-slate-600">SMIRK RECORD</p><p className="mt-1 truncate text-xs text-slate-400">{lead.smirkHandoffAt ? new Date(lead.smirkHandoffAt).toLocaleDateString() : "Not submitted"}</p></div><ChevronRight className="self-center h-4 w-4 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-300" /></Link>;
        })}</div>}
      </section>
    </OperatorShell>
  );
}
