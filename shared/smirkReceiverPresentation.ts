export type SmirkReceiverPresentation = {
  label: "Verifying receiver" | "Receiver reachable" | "Receiver blocked";
  tone: "verifying" | "reachable" | "blocked";
};

/** Keeps missing query data distinct from an actual negative diagnostic result. */
export function getSmirkReceiverPresentation(state?: string | null): SmirkReceiverPresentation {
  if (!state) return { label: "Verifying receiver", tone: "verifying" };
  if (state === "reachable") return { label: "Receiver reachable", tone: "reachable" };
  return { label: "Receiver blocked", tone: "blocked" };
}
