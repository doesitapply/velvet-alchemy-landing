import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { checkDailySendLimit } from "./lib/emailOutreach";
import { throwSmirkOutreachAuthority } from "./lib/smirkOutreachBoundary";

export const emailRouter = router({
  /**
   * Generate review-only email content for an owned lead.
   */
  generateOutreach: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        recipientEmail: z.string().email().optional(),
      })
    )
    .query(async () => {
      throwSmirkOutreachAuthority();
    }),

  /**
   * Get email preview without sending
   */
  previewOutreach: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        recipientEmail: z.string().email().optional(),
      })
    )
    .query(async () => {
      throwSmirkOutreachAuthority();
    }),

  /**
   * Compatibility query. Delivery is disabled, so the limit is always zero.
   */
  checkSendLimit: protectedProcedure.query(async ({ ctx }) => {
    return await checkDailySendLimit(ctx.user.id);
  }),
});
