import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getLeadById, updateLead } from "./db";
import { generateOutreachEmail, sendEmailViaGmail, checkDailySendLimit } from "./lib/emailOutreach";

export const emailRouter = router({
  /**
   * Send outreach email to a lead
   */
  sendOutreach: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      recipientEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check daily send limit
      const limitCheck = await checkDailySendLimit(ctx.user.id);
      if (!limitCheck.canSend) {
        throw new Error(`Daily send limit reached (${limitCheck.limit} emails/day). Try again tomorrow.`);
      }

      // Get lead details
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (lead.status !== 'audited') {
        throw new Error("Lead must be audited before sending outreach email");
      }

      if (!lead.detailedReport) {
        throw new Error("Lead must have detailed report before sending outreach");
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

      // Send via Gmail MCP
      const result = await sendEmailViaGmail({
        to: email.recipientEmail,
        subject: email.subject,
        body: email.body,
      });

      if (!result.success) {
        throw new Error(`Failed to send email: ${result.error}`);
      }

      // Update lead status
      await updateLead(input.leadId, {
        status: 'contacted',
      });

      // TODO: Log email send in email_logs table

      return {
        success: true,
        messageId: result.messageId,
        recipientEmail: email.recipientEmail,
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
