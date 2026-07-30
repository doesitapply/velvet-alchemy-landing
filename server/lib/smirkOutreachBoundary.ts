import { TRPCError } from "@trpc/server";

export const SMIRK_OUTREACH_AUTHORITY_MESSAGE =
  "Velvet is research-only. Export the reviewed lead to SMIRK; draft QC, approval, email delivery, and manual-call records live there.";

export function throwSmirkOutreachAuthority(): never {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: SMIRK_OUTREACH_AUTHORITY_MESSAGE,
  });
}
