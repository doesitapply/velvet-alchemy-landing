export type SmirkHandoffConfirmationInput = {
  leadId: number;
  companyName: string;
  phone: string;
};

export type SmirkHandoffConfirmation = {
  title: string;
  description: string;
  actionLabel: string;
  target: readonly [string, string][];
  warning: string;
};

/**
 * The real-lead handoff confirmation contract. It intentionally describes the
 * downstream consequence accurately: submitting sends a brief to SMIRK; it
 * does not claim the browser itself places a call.
 */
export function buildSmirkHandoffConfirmation({
  leadId,
  companyName,
  phone,
}: SmirkHandoffConfirmationInput): SmirkHandoffConfirmation {
  return {
    title: "Confirm SMIRK Handoff",
    description: "This sends the lead brief to SMIRK’s receiver. It does not itself place a call, but it makes this prospect available to SMIRK’s outbound workflow. Continue only when you intend that downstream action.",
    actionLabel: "Confirm Handoff to SMIRK",
    target: [
      ["Business", companyName],
      ["Phone", phone],
      ["Lead ID", String(leadId)],
    ],
    warning: "The request is idempotent on SMIRK. Duplicate payloads are accepted as duplicates; unexpected receiver failures remain hard errors.",
  };
}
