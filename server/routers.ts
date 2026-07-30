import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  addToWaitlist,
  createLead,
  getDb,
  getLeadsByUserId,
  getLeadById,
  updateLead,
  createAudit,
  getAuditByLeadId,
} from "./db";
import { auditLog } from "../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { captureScreenshot } from "./screenshot";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { analyzeVisualDebt } from "./visualAudit";
import {
  checkRateLimit,
  checkKillSwitch,
  logAudit,
  checkDomainReputation,
} from "./governor";
import { governorRouter } from "./governorRouter";
import { charmerRouter } from "./charmerRouter";
import { orchestratorRouter } from "./orchestratorRouter";
import { scraperRouter } from "./scraperRouter";
import { exportRouter } from "./exportRouter";
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
import { externalActionBlock } from "./lib/externalActionPolicy";
import {
  isPrivilegedUser,
  requireCostAuthority,
  requireOwnedLead,
  requirePrivilegedUser,
} from "./lib/accessControl";
import {
  buildSmirkResearchPayload,
  buildSmirkResearchPayloadHash,
  readSmirkResearchConfig,
  sendSmirkResearchProspect,
} from "./lib/smirkResearch";

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
      .input(
        z.object({
          email: z.string().email(),
          targetNiche: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await addToWaitlist(input.email, input.targetNiche);
        return result;
      }),
  }),

  leads: router({
    createPublic: publicProcedure
      .input(
        z.object({
          companyName: z.string().min(1),
          websiteUrl: z.string().url(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message:
            "Public lead creation is disabled because it can trigger billable screenshot, storage, and AI work. Sign in and use the governed operator flow.",
        });
      }),

    create: protectedProcedure
      .input(
        z.object({
          companyName: z.string().min(1),
          websiteUrl: z.string().url(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireCostAuthority(ctx.user);
        // Governor: Check kill-switch
        await checkKillSwitch(ctx.user.id);

        // Governor: Check rate limits
        await checkRateLimit(ctx.user.id, "lead_create");

        // Governor: Check domain reputation
        const domainSafe = await checkDomainReputation(input.websiteUrl);
        if (!domainSafe) {
          await logAudit({
            userId: ctx.user.id,
            action: "lead_create",
            resource: "leads",
            details: `Blocked: Domain ${input.websiteUrl} flagged as unsafe`,
            status: "blocked",
          });
          throw new Error("Domain flagged as unsafe or blacklisted");
        }

        // Capture screenshot
        const screenshot = await captureScreenshot(input.websiteUrl);

        if (!screenshot.success) {
          throw new Error(`Failed to capture screenshot: ${screenshot.error}`);
        }

        // Upload to S3
        const fileKey = `leads/${ctx.user.id}/${nanoid()}.png`;
        const uploadResult = await storagePut(
          fileKey,
          screenshot.buffer,
          "image/png"
        );

        // Create lead record
        const lead = await createLead({
          userId: ctx.user.id,
          companyName: input.companyName,
          websiteUrl: input.websiteUrl,
          screenshotUrl: uploadResult.url,
          screenshotKey: fileKey,
          status: "pending",
        });

        if (!lead) {
          throw new Error("Failed to create lead record");
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
          status: "audited",
        });

        // Governor: Log successful lead creation
        await logAudit({
          userId: ctx.user.id,
          action: "lead_create",
          resource: "leads",
          resourceId: lead.id,
          details: `Created lead for ${input.companyName}`,
          status: "success",
        });

        // Auto-enqueue into FIFO pipeline queue
        try {
          const { enqueueLeadForPipeline } = await import("./worker");
          await enqueueLeadForPipeline(lead.id);
        } catch (enqueueErr) {
          console.error(
            "[leads.create] Failed to enqueue lead for pipeline:",
            enqueueErr
          );
        }

        return { lead: updatedLead || lead, audit };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const leads = await getLeadsByUserId(ctx.user.id);
      return leads;
    }),

    listAll: protectedProcedure.query(async ({ ctx }) => {
      if (!isPrivilegedUser(ctx.user)) {
        return getLeadsByUserId(ctx.user.id);
      }
      const { getAllLeads } = await import("./db");
      const leads = await getAllLeads();
      return leads;
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const lead = await requireOwnedLead(input.id, ctx.user);

        const audit = await getAuditByLeadId(lead.id);

        return { lead, audit };
      }),

    captureScreenshot: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireCostAuthority(ctx.user);
        await checkKillSwitch(ctx.user.id);
        await checkRateLimit(ctx.user.id, "screenshot_capture");
        const lead = await requireOwnedLead(input.leadId, ctx.user);

        // Capture screenshot
        const screenshot = await captureScreenshot(lead.websiteUrl);

        if (!screenshot.success) {
          throw new Error(`Failed to capture screenshot: ${screenshot.error}`);
        }

        // Upload to S3
        const fileKey = `leads/${lead.userId}/${nanoid()}.png`;
        const uploadResult = await storagePut(
          fileKey,
          screenshot.buffer,
          "image/png"
        );

        // Update lead with screenshot
        const updatedLead = await updateLead(lead.id, {
          screenshotUrl: uploadResult.url,
          screenshotKey: fileKey,
        });

        return {
          success: true,
          lead: updatedLead,
          screenshotUrl: uploadResult.url,
        };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const lead = await requireOwnedLead(input.id, ctx.user);

        // Delete lead from database
        const { deleteLead } = await import("./db");
        await deleteLead(input.id);

        // Governor: Log lead deletion
        await logAudit({
          userId: ctx.user.id,
          action: "lead_delete",
          resource: "leads",
          resourceId: input.id,
          details: `Deleted lead for ${lead.companyName}`,
          status: "success",
        });

        return { success: true };
      }),

    triggerHandoff: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        const block = externalActionBlock("prospect_handoff");
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message:
            "Prospect call handoffs are disabled. Administrators may use the separate SMIRK research queue, which never authorizes contact.",
          cause: block,
        });
      }),

    smirkResearchReadiness: protectedProcedure.query(({ ctx }) => {
      if (!isPrivilegedUser(ctx.user)) {
        return {
          authorized: false,
          configured: false,
          missing: [] as string[],
          mode: "research_only" as const,
          endpoint: null,
          externalActions: "none" as const,
        };
      }
      const config = readSmirkResearchConfig();
      return {
        authorized: true,
        configured: config.configured,
        missing: config.missing,
        mode: "research_only" as const,
        endpoint: config.configured
          ? `${config.baseUrl}/api/integrations/velvet/prospects`
          : null,
        externalActions: "none" as const,
      };
    }),

    smirkResearchReceipt: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        requirePrivilegedUser(ctx.user);
        await requireOwnedLead(input.id, ctx.user);
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Database unavailable.",
          });
        }
        const [receipt] = await db
          .select({
            details: auditLog.details,
            createdAt: auditLog.createdAt,
          })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.action, "smirk_research_export_success"),
              eq(auditLog.resource, "lead"),
              eq(auditLog.resourceId, input.id)
            )
          )
          .orderBy(desc(auditLog.createdAt))
          .limit(1);
        if (!receipt) return null;

        try {
          const details = JSON.parse(receipt.details || "{}");
          const campaignId = Number(details.campaignId);
          const prospectId = Number(details.prospectId);
          if (
            !["IMPORTED", "DUPLICATE"].includes(details.state) ||
            !Number.isSafeInteger(campaignId) ||
            campaignId <= 0 ||
            !Number.isSafeInteger(prospectId) ||
            prospectId <= 0 ||
            details.externalAction !== "none"
          ) {
            return null;
          }
          return {
            state: details.state as "IMPORTED" | "DUPLICATE",
            campaignId,
            prospectId,
            externalAction: "none" as const,
            recordedAt: receipt.createdAt,
          };
        } catch {
          return null;
        }
      }),

    addToSmirkResearch: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        requirePrivilegedUser(ctx.user);
        await checkKillSwitch(ctx.user.id);
        const lead = await requireOwnedLead(input.id, ctx.user);
        if (lead.status !== "audited") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Only an audited lead can be added to the SMIRK research queue.",
          });
        }
        const audit = await getAuditByLeadId(lead.id);
        if (!audit) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "The lead must have a persisted audit before it can be added to SMIRK research.",
          });
        }

        const config = readSmirkResearchConfig();
        if (!config.configured || !config.workspaceId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `SMIRK research is not configured: ${config.missing.join(", ")}`,
          });
        }
        const payload = buildSmirkResearchPayload(lead, config.workspaceId);
        const payloadHash = buildSmirkResearchPayloadHash(payload);
        await checkRateLimit(ctx.user.id, "smirk_research_export");
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Database unavailable.",
          });
        }

        await db.insert(auditLog).values({
          userId: ctx.user.id,
          action: "smirk_research_export_started",
          resource: "lead",
          resourceId: lead.id,
          details: JSON.stringify({
            externalId: payload.externalId,
            payloadHash,
            workspaceId: payload.workspaceId,
            externalAction: "none",
          }),
          status: "success",
        });

        const result = await sendSmirkResearchProspect(payload, config);
        await db.insert(auditLog).values({
          userId: ctx.user.id,
          action: result.success
            ? "smirk_research_export_success"
            : "smirk_research_export_failure",
          resource: "lead",
          resourceId: lead.id,
          details: JSON.stringify({
            externalId: payload.externalId,
            payloadHash,
            workspaceId: payload.workspaceId,
            state: result.state,
            campaignId: result.campaignId,
            prospectId: result.prospectId,
            httpStatus: result.httpStatus,
            code: result.code,
            error: result.error?.slice(0, 500),
            externalAction: result.externalAction || "unconfirmed",
          }),
          status: result.success ? "success" : "failure",
        });

        if (!result.success) {
          throw new TRPCError({
            code: result.httpStatus === 409 ? "CONFLICT" : "BAD_GATEWAY",
            message:
              result.error || "SMIRK did not confirm the research import.",
          });
        }
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
