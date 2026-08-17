import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OperatorShell, SmirkReceiverPill } from "@/components/OperatorShell";
import { trpc } from "@/lib/trpc";
import { buildSmirkHandoffConfirmation } from "@shared/smirkHandoffConfirmation";
import { isReadyForSmirkReview } from "@shared/smirkLifecycle";
import { evaluateSmirkQualification } from "@shared/smirkQualification";
import { ArrowLeft, CheckCircle2, ChevronRight, CircleAlert, ExternalLink, Loader2, MapPin, PhoneCall, PhoneMissed, Play, Radio, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

function leadStatus(status: string, outcome?: string | null) {
  if (outcome) return { label: outcome.replace(/_/g, " "), className: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100" };
  if (status === "smirk_queued") return { label: "Queued in SMIRK", className: "border-violet-300/20 bg-violet-300/10 text-violet-100" };
  if (status === "smirk_contacted") return { label: "SMIRK contacted", className: "border-blue-300/20 bg-blue-300/10 text-blue-100" };
  if (status === "audited") return { label: "Audited", className: "border-slate-300/20 bg-slate-300/[0.06] text-slate-200" };
  if (status === "pending") return { label: "Audit pending", className: "border-amber-300/20 bg-amber-300/10 text-amber-100" };
  return { label: status.replace(/_/g, " "), className: "border-white/[0.1] bg-white/[0.04] text-slate-300" };
}

function OutcomeIcon({ outcome }: { outcome?: string | null }) {
  if (outcome === "interested" || outcome === "booked") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (outcome === "not_interested") return <XCircle className="h-4 w-4 text-rose-300" />;
  if (outcome === "no_answer" || outcome === "voicemail") return <PhoneMissed className="h-4 w-4 text-amber-300" />;
  return <PhoneCall className="h-4 w-4 text-cyan-300" />;
}

export default function LeadDetail() {
  const [, params] = useRoute("/leads/:id");
  const leadId = params?.id ? Number(params.id) : null;
  const [handoffConfirmOpen, setHandoffConfirmOpen] = useState(false);
  const detailQuery = trpc.leads.getById.useQuery({ id: leadId ?? 0 }, { enabled: Boolean(leadId) });
  const smirkQuery = trpc.leads.smirkStats.useQuery(undefined, { refetchInterval: 30_000 });
  const startAudit = trpc.orchestrator.executePipeline.useMutation({
    onSuccess: () => toast.success("Audit started. This record will refresh as stages complete."),
    onError: error => toast.error(`Audit could not start: ${error.message}`),
  });
  const triggerHandoff = trpc.leads.triggerHandoff.useMutation({
    onSuccess: result => {
      toast.success(`SMIRK handoff accepted — ${result.state}`);
      setHandoffConfirmOpen(false);
      detailQuery.refetch();
      smirkQuery.refetch();
    },
    onError: error => toast.error(`Handoff blocked: ${error.message}`),
  });

  const parsedAudit = useMemo(() => {
    const raw = detailQuery.data?.audit?.visualDebtData;
    if (!raw) return null;
    try { return JSON.parse(raw) as { strengths?: string[]; weaknesses?: string[]; visualDebt?: Array<{ severity?: string; category?: string; issue?: string; recommendation?: string }> }; }
    catch { return null; }
  }, [detailQuery.data?.audit?.visualDebtData]);

  const record = detailQuery.data;

  if (!leadId || detailQuery.isError || (!detailQuery.isLoading && !record)) {
    return <OperatorShell eyebrow="LEAD INTELLIGENCE" title="Lead unavailable" description="This record could not be loaded or is no longer available."><Link href="/smirk-queue"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to queue</Button></Link></OperatorShell>;
  }
  if (detailQuery.isLoading) {
    return <OperatorShell eyebrow="LEAD INTELLIGENCE" title="Loading lead record"><div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-violet-300" /></div></OperatorShell>;
  }

  if (!record) {
    return <OperatorShell eyebrow="LEAD INTELLIGENCE" title="Loading lead record"><div className="grid min-h-72 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-violet-300" /></div></OperatorShell>;
  }

  const { lead, audit } = record;
  const qualification = record.qualification ?? evaluateSmirkQualification({ ...lead, prestigeScore: audit?.prestigeScore ?? lead.prestigeScore });
  const canHandoff = qualification.eligible && isReadyForSmirkReview(lead);
  const status = leadStatus(lead.status, lead.smirkCallOutcome);
  const handoffConfirmation = buildSmirkHandoffConfirmation({ leadId: lead.id, companyName: lead.companyName, phone: String(lead.phone ?? "") });
  const auditScore = audit?.prestigeScore ?? lead.prestigeScore;
  const auditScoreColor = auditScore === null || auditScore === undefined ? "text-slate-400" : auditScore < 40 ? "text-rose-200" : auditScore < 60 ? "text-amber-200" : "text-emerald-200";

  return (
    <OperatorShell
      eyebrow="LEAD INTELLIGENCE"
      title={lead.companyName}
      description="The evidence and decision record for this specific business. SMIRK receives a brief only after explicit operator confirmation."
      actions={<Link href="/smirk-queue"><Button size="sm" variant="outline" className="border-white/[0.1] bg-white/[0.03] text-slate-200 hover:bg-white/[0.08]"><ArrowLeft className="mr-2 h-3.5 w-3.5" /> Queue</Button></Link>}
    >
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0f17]/85 p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={`border text-xs capitalize ${status.className}`}>{status.label}</Badge>{lead.category && <Badge variant="outline" className="border-white/[0.1] bg-white/[0.025] text-xs text-slate-400">{lead.category}</Badge>}</div><h2 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">{lead.companyName}</h2><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">{lead.phone && <span className="flex items-center gap-1.5"><PhoneCall className="h-3.5 w-3.5 text-slate-600" />{lead.phone}</span>}{(lead.city || lead.state) && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-600" />{[lead.city, lead.state].filter(Boolean).join(", ")}</span>}<span>Created {new Date(lead.createdAt).toLocaleDateString()}</span></div></div><Button variant="outline" className="h-9 shrink-0 border-white/[0.1] bg-white/[0.025] text-slate-300 hover:bg-white/[0.08]" onClick={() => window.open(lead.websiteUrl, "_blank", "noopener,noreferrer")}>Open website <ExternalLink className="ml-2 h-3.5 w-3.5" /></Button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">AUDIT SCORE</p><p className={`mt-2 text-2xl font-semibold ${auditScoreColor}`}>{auditScore ?? "—"}</p></div><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">PHONE</p><p className="mt-2 text-sm font-medium text-slate-200">{lead.phone ? "Present" : "Missing"}</p></div><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">HANDOFF</p><p className="mt-2 text-sm font-medium text-slate-200">{lead.smirkHandoffAt ? new Date(lead.smirkHandoffAt).toLocaleDateString() : "Not submitted"}</p></div></div>
        </div>

        <aside className="rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.12] to-[#0d0f17] p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-violet-200">SMIRK DECISION</p><h2 className="mt-2 text-lg font-semibold text-white">{canHandoff ? "Qualified for operator review" : "Qualification blocked"}</h2></div><Radio className="h-5 w-5 text-violet-200" /></div><div className="mt-4"><SmirkReceiverPill state={smirkQuery.data?.diagnostics.state} /></div><div className={`mt-4 rounded-xl border p-3 ${qualification.eligible ? "border-emerald-300/15 bg-emerald-300/[0.04]" : "border-rose-300/15 bg-rose-300/[0.04]"}`}><p className={`text-[10px] font-semibold tracking-[0.15em] ${qualification.eligible ? "text-emerald-200" : "text-rose-200"}`}>{qualification.eligible ? "QUALIFICATION EVIDENCE" : "BLOCKING REQUIREMENTS"}</p><ul className="mt-2 space-y-1.5">{(qualification.eligible ? qualification.evidence : qualification.blockers).map(item => <li key={item.code} className="text-xs leading-5 text-slate-300"><span className="font-medium">{item.label}.</span> {item.detail}</li>)}</ul></div><p className="mt-4 text-xs leading-5 text-slate-300">{canHandoff ? "Open the confirmation step to inspect the exact target before the brief is submitted to SMIRK." : "SMIRK handoff remains disabled until every qualification requirement is satisfied."}</p><div className="mt-5">{lead.status === "pending" ? <Button className="w-full bg-cyan-500 text-white hover:bg-cyan-400" disabled={startAudit.isPending} onClick={() => startAudit.mutate({ leadId: lead.id })}>{startAudit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting audit</> : <><Play className="mr-2 h-4 w-4" /> Start audit</>}</Button> : canHandoff ? <Button className="w-full bg-violet-500 text-white hover:bg-violet-400" disabled={triggerHandoff.isPending || smirkQuery.data?.diagnostics.state !== "reachable"} onClick={() => setHandoffConfirmOpen(true)}><PhoneCall className="mr-2 h-4 w-4" /> Review SMIRK handoff</Button> : <Button className="w-full" variant="outline" disabled><CircleAlert className="mr-2 h-4 w-4" /> Qualification required</Button>}</div></aside>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <Card className="rounded-2xl border-white/[0.08] bg-[#0d0f17]/80 p-5 shadow-none"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">AUDIT EVIDENCE</p><h2 className="mt-1 text-lg font-semibold text-white">What Velvet observed</h2></div><Sparkles className="h-4 w-4 text-cyan-200" /></div>{audit ? <div className="mt-5 space-y-5"><p className="text-sm leading-6 text-slate-300">{audit.summary || "No audit summary is available for this lead."}</p>{parsedAudit && <div className="grid gap-4 md:grid-cols-2">{parsedAudit.strengths?.length ? <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-4"><p className="text-[10px] font-semibold tracking-[0.15em] text-emerald-200">SIGNALS TO PRESERVE</p><ul className="mt-3 space-y-2">{parsedAudit.strengths.slice(0, 5).map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />{item}</li>)}</ul></div> : null}{parsedAudit.weaknesses?.length ? <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.035] p-4"><p className="text-[10px] font-semibold tracking-[0.15em] text-rose-200">CALL-RELEVANT GAPS</p><ul className="mt-3 space-y-2">{parsedAudit.weaknesses.slice(0, 5).map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-300"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-rose-300" />{item}</li>)}</ul></div> : null}</div>}{parsedAudit?.visualDebt?.length ? <div><p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">EVIDENCE LOG</p><div className="mt-3 space-y-2">{parsedAudit.visualDebt.slice(0, 5).map((item, index) => <div key={`${item.issue}-${index}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex flex-wrap items-center gap-2"><Badge className="border-amber-300/15 bg-amber-300/[0.07] text-[10px] uppercase text-amber-100">{item.severity ?? "observed"}</Badge>{item.category && <span className="text-[10px] uppercase tracking-wide text-slate-600">{item.category}</span>}</div><p className="mt-2 text-sm text-slate-200">{item.issue}</p>{item.recommendation && <p className="mt-1 text-xs leading-5 text-slate-500">{item.recommendation}</p>}</div>)}</div></div> : null}</div> : <div className="mt-5 rounded-xl border border-dashed border-white/[0.1] p-6 text-center text-sm text-slate-500">No audit evidence has been captured yet.</div>}</Card>
          {lead.screenshotUrl && <Card className="overflow-hidden rounded-2xl border-white/[0.08] bg-[#0d0f17]/80 p-5 shadow-none"><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">VISUAL CAPTURE</p><img src={lead.screenshotUrl} alt={`Captured website for ${lead.companyName}`} className="mt-4 w-full rounded-xl border border-white/[0.08]" /></Card>}
        </div>

        <aside className="space-y-5"><Card className="rounded-2xl border-white/[0.08] bg-[#0d0f17]/80 p-5 shadow-none"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">CALL INTELLIGENCE</p><h2 className="mt-1 text-lg font-semibold text-white">SMIRK outcome</h2></div><OutcomeIcon outcome={lead.smirkCallOutcome} /></div>{lead.smirkHandoffAt ? <div className="mt-5 space-y-4 text-sm"><div><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">RECEIVER RECORD</p><p className="mt-1.5 text-slate-300">Submitted {new Date(lead.smirkHandoffAt).toLocaleString()}</p></div>{lead.smirkWorkspaceId && <div><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">WORKSPACE</p><p className="mt-1.5 text-slate-300">{lead.smirkWorkspaceId}</p></div>}{lead.smirkCallOutcome && <div><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">OUTCOME</p><p className="mt-1.5 capitalize text-slate-200">{lead.smirkCallOutcome.replace(/_/g, " ")}</p></div>}{lead.smirkCallSummary && <div className="border-t border-white/[0.07] pt-4"><p className="text-[10px] font-semibold tracking-[0.15em] text-slate-600">RETURNED SUMMARY</p><p className="mt-2 text-xs leading-5 text-slate-400">{lead.smirkCallSummary}</p></div>}</div> : <div className="mt-5 rounded-xl border border-dashed border-white/[0.1] p-5 text-xs leading-5 text-slate-500">No handoff has been accepted by SMIRK for this lead. There is no call state to infer.</div>}</Card><Card className="rounded-2xl border-white/[0.08] bg-[#0d0f17]/80 p-5 shadow-none"><p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">SAFETY BOUNDARY</p><div className="mt-4 flex gap-3"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /><p className="text-xs leading-5 text-slate-400">This view does not send email or SMS. A call brief can only be submitted through the explicit SMIRK confirmation step after the audit and phone requirements are met.</p></div></Card></aside>
      </section>

      <AlertDialog open={handoffConfirmOpen} onOpenChange={setHandoffConfirmOpen}><AlertDialogContent className="border-violet-300/25 bg-[#11131d] text-slate-100"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-white"><Radio className="h-4 w-4 text-violet-200" />{handoffConfirmation.title}</AlertDialogTitle><AlertDialogDescription className="leading-6 text-slate-400">{handoffConfirmation.description}</AlertDialogDescription></AlertDialogHeader><div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">{handoffConfirmation.target.map(([label, value]) => <p key={label} className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-slate-500">{label}</span><span className="text-right text-slate-200">{value}</span></p>)}<div className="mt-3 border-t border-white/[0.07] pt-3"><p className="text-[10px] font-semibold tracking-[0.14em] text-emerald-200">QUALIFICATION CONFIRMED</p><p className="mt-1 text-xs leading-5 text-slate-400">{qualification.evidence.map(item => item.label).join(" · ")}</p></div><p className="mt-3 text-xs leading-5 text-slate-500">{handoffConfirmation.warning}</p></div><AlertDialogFooter><AlertDialogCancel disabled={triggerHandoff.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={triggerHandoff.isPending || smirkQuery.data?.diagnostics.state !== "reachable" || !qualification.eligible} onClick={event => { event.preventDefault(); triggerHandoff.mutate({ id: lead.id }); }} className="bg-violet-500 text-white hover:bg-violet-400">{triggerHandoff.isPending ? "Submitting…" : handoffConfirmation.actionLabel}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </OperatorShell>
  );
}
