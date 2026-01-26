import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getLeadById, updateLead } from "./db";
import { generateOutreachEmail, sendEmailViaGmail, checkDailySendLimit } from "./lib/emailOutreach";

export const emailRouter = router({
  /**
   * Generate outreach email content for a lead
   * Returns email data that can be sent via Gmail MCP through Manus UI
   */
  generateOutreach: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      recipientEmail: z.string().email().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Get lead details
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (lead.status !== 'audited') {
        throw new Error("Lead must be audited before generating outreach email");
      }

      if (!lead.detailedReport) {
        throw new Error("Lead must have detailed report before generating outreach");
      }

      // Parse detailed report
      const detailedReport = JSON.parse(lead.detailedReport);

      // Generate email
      const email = generateOutreachEmail({
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        prestigeScore: lead.prestigeScore || 50,
        detailedReport,
        contactEmail: input.recipientEmail,
      });

      return {
        to: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        leadId: input.leadId,
        companyName: lead.companyName,
      };
    }),

  /**
   * Get email preview without sending
   */
  previewOutreach: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      recipientEmail: z.string().email().optional(),
    }))
    .query(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (!lead.detailedReport) {
        throw new Error("Lead must have detailed report to preview email");
      }

      const detailedReport = JSON.parse(lead.detailedReport);

      const email = generateOutreachEmail({
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        prestigeScore: lead.prestigeScore || 50,
        detailedReport,
        contactEmail: input.recipientEmail,
      });

      return email;
    }),

  /**
   * Check daily send limit
   */
  checkSendLimit: protectedProcedure
    .query(async ({ ctx }) => {
      return await checkDailySendLimit(ctx.user.id);
    }),
});
