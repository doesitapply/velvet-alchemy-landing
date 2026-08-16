export type SmirkLifecycleLead = {
  status: string;
  phone?: string | null;
  smirkCallOutcome?: string | null;
};

export function isReadyForSmirkReview(lead: SmirkLifecycleLead): boolean {
  return ["audited", "contacted"].includes(lead.status) && Boolean(lead.phone);
}

export function isInSmirkLifecycle(lead: SmirkLifecycleLead): boolean {
  return lead.status === "smirk_queued" || lead.status === "smirk_contacted" || Boolean(lead.smirkCallOutcome);
}

export function getSmirkLifecycleCounts(leads: SmirkLifecycleLead[]) {
  return {
    audited: leads.filter(lead => lead.status === "audited").length,
    ready: leads.filter(isReadyForSmirkReview).length,
    queued: leads.filter(lead => lead.status === "smirk_queued").length,
    outcomes: leads.filter(lead => Boolean(lead.smirkCallOutcome)).length,
  };
}
