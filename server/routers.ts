import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { addToWaitlist, createLead, getLeadsByUserId, getLeadById, updateLead, createAudit, getAuditByLeadId } from "./db";
import { captureScreenshot } from "./screenshot";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { analyzeVisualDebt } from "./visualAudit";
import { checkRateLimit, checkKillSwitch, logAudit, checkDomainReputation } from "./governor";
import { governorRouter } from "./governorRouter";
import { charmerRouter } from "./charmerRouter";
import { orchestratorRouter } from "./orchestratorRouter";
import { scraperRouter } from './scraperRouter';
import { exportRouter } from './exportRouter';
import { dashboardRouter } from "./dashboardRouter";
import { visionaryRouter } from "./visionaryRouter";
import { prescreenerRouter } from "./routers/prescreenerRouter";
import { emailRouter } from "./emailRouter";
import { websiteGeneratorRouter } from "./websiteGeneratorRouter";
import { paymentRouter } from "./paymentRouter";
import { onboardingRouter } from "./onboardingRouter";
import { costRouter } from "./costRouter";
import { outreachRouter } from "./outreachRouter";
import { providerRouter } from "./providerRouter";
import { apiKeyRouter } from "./apiKeyRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  governor: governorRouter,
  charmer: charmerRouter,
  orchestrator: orchestratorRouter,
  scraper: scraperRouter,
  export: exportRouter,
  dashboard: dashboardRouter,
  visionary: visionaryRouter,
  prescreener: prescreenerRouter,
  email: emailRouter,
  websiteGenerator: websiteGeneratorRouter,
  payment: paymentRouter,
  onboarding: onboardingRouter,
  cost: costRouter,
  outreach: outreachRouter,
  provider: providerRouter,
  apiKeys: apiKeyRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  waitlist: router({
    join: publicProcedure
      .input(z.object({
        email: z.string().email(),
        targetNiche: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await addToWaitlist(input.email, input.targetNiche);
        return result;
      }),
  }),

  leads: router({
    createPublic: publicProcedure
      .input(z.object({
        companyName: z.string().min(1),
        websiteUrl: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        // For public form submissions, use a default system user ID
        const SYSTEM_USER_ID = 1; // Owner's user ID from env

        // Capture screenshot
        const screenshot = await captureScreenshot(input.websiteUrl);
        
        if (!screenshot.success) {
          throw new Error(`Failed to capture screenshot: ${screenshot.error}`);
        }

        // Upload to S3
        const fileKey = `leads/public/${nanoid()}.png`;
        const uploadResult = await storagePut(fileKey, screenshot.buffer, 'image/png');

        // Create lead record
        const lead = await createLead({
          userId: SYSTEM_USER_ID,
          companyName: input.companyName,
          websiteUrl: input.websiteUrl,
          screenshotUrl: uploadResult.url,
          screenshotKey: fileKey,
          status: 'pending',
        });

        if (!lead) {
          throw new Error('Failed to create lead record');
        }

        // Run visual audit using LLM
        const auditResult = await analyzeVisualDebt(
          uploadResult.url,
          input.websiteUrl,
          input.companyName
        );

        // Create audit record with LLM results
        const audit = await createAudit({
          leadId: lead.id,
          summary: auditResult.summary,
          prestigeScore: auditResult.prestigeScore,
          visualDebtData: JSON.stringify(auditResult),
        });

        // Update lead with prestige score
        const updatedLead = await updateLead(lead.id, {
          prestigeScore: auditResult.prestigeScore,
          status: 'audited',
        });

        // Auto-enqueue public lead into FIFO pipeline queue
        try {
          const { enqueueLeadForPipeline } = await import('./worker');
          await enqueueLeadForPipeline(lead.id);
        } catch (enqueueErr) {
          console.error('[leads.createPublic] Failed to enqueue lead for pipeline:', enqueueErr);
        }

        return { lead: updatedLead || lead, audit };
      }),

    create: protectedProcedure
      .input(z.object({
        companyName: z.string().min(1),
        websiteUrl: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Governor: Check kill-switch
        await checkKillSwitch(ctx.user.id);

        // Governor: Check rate limits
        await checkRateLimit(ctx.user.id, 'lead_create');

        // Governor: Check domain reputation
        const domainSafe = await checkDomainReputation(input.websiteUrl);
        if (!domainSafe) {
          await logAudit({
            userId: ctx.user.id,
            action: 'lead_create',
            resource: 'leads',
            details: `Blocked: Domain ${input.websiteUrl} flagged as unsafe`,
            status: 'blocked',
          });
          throw new Error('Domain flagged as unsafe or blacklisted');
        }

        // Capture screenshot
        const screenshot = await captureScreenshot(input.websiteUrl);
        
        if (!screenshot.success) {
          throw new Error(`Failed to capture screenshot: ${screenshot.error}`);
        }

        // Upload to S3
        const fileKey = `leads/${ctx.user.id}/${nanoid()}.png`;
        const uploadResult = await storagePut(fileKey, screenshot.buffer, 'image/png');

        // Create lead record
        const lead = await createLead({
          userId: ctx.user.id,
          companyName: input.companyName,
          websiteUrl: input.websiteUrl,
          screenshotUrl: uploadResult.url,
          screenshotKey: fileKey,
          status: 'pending',
        });

        if (!lead) {
          throw new Error('Failed to create lead record');
        }

        // Run visual audit using LLM
        const auditResult = await analyzeVisualDebt(
          uploadResult.url,
          input.websiteUrl,
          input.companyName
        );

        // Create audit record with LLM results
        const audit = await createAudit({
          leadId: lead.id,
          summary: auditResult.summary,
          prestigeScore: auditResult.prestigeScore,
          visualDebtData: JSON.stringify(auditResult),
        });

        // Update lead with prestige score
        const updatedLead = await updateLead(lead.id, {
          prestigeScore: auditResult.prestigeScore,
          status: 'audited',
        });

        // Governor: Log successful lead creation
        await logAudit({
          userId: ctx.user.id,
          action: 'lead_create',
          resource: 'leads',
          resourceId: lead.id,
          details: `Created lead for ${input.companyName}`,
          status: 'success',
        });

        // Auto-enqueue into FIFO pipeline queue
        try {
          const { enqueueLeadForPipeline } = await import('./worker');
          await enqueueLeadForPipeline(lead.id);
        } catch (enqueueErr) {
          console.error('[leads.create] Failed to enqueue lead for pipeline:', enqueueErr);
        }

        return { lead: updatedLead || lead, audit };
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        const leads = await getLeadsByUserId(ctx.user.id);
        return leads;
      }),

    listAll: protectedProcedure
      .query(async () => {
        const { getAllLeads } = await import('./db');
        const leads = await getAllLeads();
        return leads;
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const lead = await getLeadById(input.id);
        if (!lead) {
          throw new Error('Lead not found');
        }
        
        const audit = await getAuditByLeadId(lead.id);
        
        const { getSmirkQualification } = await import('./lib/smirkHandoff');
        const qualification = await getSmirkQualification(lead.id);
        return { lead, audit, qualification };
      }),

    captureScreenshot: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) {
          throw new Error('Lead not found');
        }

        // Capture screenshot
        const screenshot = await captureScreenshot(lead.websiteUrl);
        
        if (!screenshot.success) {
          throw new Error(`Failed to capture screenshot: ${screenshot.error}`);
        }

        // Upload to S3
        const fileKey = `leads/${lead.userId}/${nanoid()}.png`;
        const uploadResult = await storagePut(fileKey, screenshot.buffer, 'image/png');

        // Update lead with screenshot
        const updatedLead = await updateLead(lead.id, {
          screenshotUrl: uploadResult.url,
          screenshotKey: fileKey,
        });

        return { success: true, lead: updatedLead, screenshotUrl: uploadResult.url };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const lead = await getLeadById(input.id);
        if (!lead) {
          throw new Error('Lead not found');
        }

        // Authorization: only owner or admin can delete
        if (lead.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new Error('Unauthorized to delete this lead');
        }

        // Delete lead from database
        const { deleteLead } = await import('./db');
        await deleteLead(input.id);

        // Governor: Log lead deletion
        await logAudit({
          userId: ctx.user.id,
          action: 'lead_delete',
          resource: 'leads',
          resourceId: input.id,
          details: `Deleted lead for ${lead.companyName}`,
          status: 'success',
        });

        return { success: true };
      }),

    smirkStats: protectedProcedure.query(async ({ ctx }) => {
        const { getSmirkDiagnostics } = await import('./lib/smirkHandoff');
        const diagnostics = await getSmirkDiagnostics();
        const orm = await (await import('./db')).getDb();
        if (!orm) {
          return {
            queued: 0,
            contacted: 0,
            interested: 0,
            booked: 0,
            diagnostics,
            lastHandoff: null,
          };
        }
        const { leads: leadsTable } = await import('../drizzle/schema');
        const { and, desc, eq, inArray, isNotNull } = await import('drizzle-orm');
        const rows = await orm
          .select({ status: leadsTable.status, outcome: leadsTable.smirkCallOutcome })
          .from(leadsTable)
          .where(and(
            eq(leadsTable.userId, ctx.user.id),
            inArray(leadsTable.status, ['smirk_queued', 'smirk_contacted', 'closed'])
          ));
        const latestRows = await orm
          .select({
            id: leadsTable.id,
            companyName: leadsTable.companyName,
            handoffAt: leadsTable.smirkHandoffAt,
            outcome: leadsTable.smirkCallOutcome,
          })
          .from(leadsTable)
          .where(and(eq(leadsTable.userId, ctx.user.id), isNotNull(leadsTable.smirkHandoffAt)))
          .orderBy(desc(leadsTable.smirkHandoffAt))
          .limit(1);
        const queued = rows.filter(r => r.status === 'smirk_queued').length;
        const contacted = rows.filter(r => r.status === 'smirk_contacted').length;
        const interested = rows.filter(r => r.outcome === 'interested').length;
        const booked = rows.filter(r => r.outcome === 'booked').length;
        return { queued, contacted, interested, booked, diagnostics, lastHandoff: latestRows[0] ?? null };
      }),

    triggerHandoff: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const lead = await getLeadById(input.id);
        if (!lead) throw new Error('Lead not found');
        if (lead.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new Error('Unauthorized');
        }
        const { getSmirkQualification, queueSmirkCall } = await import('./lib/smirkHandoff');
        const qualification = await getSmirkQualification(lead.id);
        if (!qualification?.eligible) {
          throw new Error(`Lead does not qualify for SMIRK: ${qualification?.blockers.map(item => item.label).join('; ') ?? 'qualification could not be evaluated'}`);
        }
        const result = await queueSmirkCall(lead.id);
        if (!result.success) throw new Error(result.error || 'SMIRK handoff failed');
        await logAudit({
          userId: ctx.user.id,
          action: 'smirk_handoff',
          resource: 'leads',
          resourceId: input.id,
          details: `Queued SMIRK call for ${lead.companyName} — state: ${result.state}`,
          status: 'success',
        });
        return { success: true, state: result.state, jobId: result.jobId };
      }),
  }),
});

export type AppRouter = typeof appRouter;
