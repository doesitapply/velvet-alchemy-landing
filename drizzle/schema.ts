
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role").default("user").notNull(), // 'user' | 'admin'
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const waitlist = sqliteTable("waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  targetNiche: text("targetNiche"),
  status: text("status").default("pending").notNull(), // 'pending', 'approved', 'rejected'
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  companyName: text("companyName").notNull(),
  websiteUrl: text("websiteUrl").notNull(),
  screenshotUrl: text("screenshotUrl"),
  screenshotKey: text("screenshotKey"),
  status: text("status").default("pending").notNull(), // 'pending', 'audited', 'contacted', 'replied', 'closed', 'paid'
  prestigeScore: integer("prestigeScore"),
  priorityScore: integer("priorityScore"),
  hasAssets: integer("hasAssets", { mode: 'boolean' }).default(false).notNull(),
  assetsStatus: text("assetsStatus").default("not_requested").notNull(), // 'not_requested', 'generating', 'ready', 'failed'
  assetsGeneratedAt: integer("assetsGeneratedAt", { mode: 'timestamp' }),
  hasOutreach: integer("hasOutreach", { mode: 'boolean' }).default(false).notNull(),
  detailedReport: text("detailedReport"), // JSON
  lastDeepScanAt: integer("lastDeepScanAt", { mode: 'timestamp' }),
  monthlyVisits: integer("monthlyVisits"),
  globalRank: integer("globalRank"),
  bounceRate: real("bounceRate"),
  trafficDataFetchedAt: integer("trafficDataFetchedAt", { mode: 'timestamp' }),
  contactEmail: text("contactEmail"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export const audits = sqliteTable("audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  summary: text("summary"),
  prestigeScore: integer("prestigeScore"),
  visualDebtData: text("visualDebtData"), // JSON
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

export const rateLimits = sqliteTable("rate_limits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  action: text("action").notNull(),
  count: integer("count").notNull().default(0),
  windowStart: integer("windowStart", { mode: 'timestamp' }).notNull(),
  windowEnd: integer("windowEnd", { mode: 'timestamp' }).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = typeof rateLimits.$inferInsert;

export const systemConfig = sqliteTable("system_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId"),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: integer("resourceId"),
  details: text("details"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  status: text("status").notNull(), // 'success', 'failure', 'blocked'
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  type: text("type").notNull(), // 'hero_header', 'social_post', 'web_banner'
  url: text("url").notNull(),
  s3Key: text("s3Key").notNull(),
  metadata: text("metadata"), // JSON
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  status: text("status").default("draft").notNull(),
  sentAt: integer("sentAt", { mode: 'timestamp' }),
  openedAt: integer("openedAt", { mode: 'timestamp' }),
  clickedAt: integer("clickedAt", { mode: 'timestamp' }),
  repliedAt: integer("repliedAt", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

export const outreachDrafts = sqliteTable("outreach_drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaignId").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientEmail: text("recipientEmail").notNull(),
  recipientName: text("recipientName"),
  status: text("status").default("draft").notNull(),
  rejectionReason: text("rejectionReason"),
  approvedBy: integer("approvedBy"),
  approvedAt: integer("approvedAt", { mode: 'timestamp' }),
  sentAt: integer("sentAt", { mode: 'timestamp' }),
  gmailMessageId: text("gmailMessageId"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type OutreachDraft = typeof outreachDrafts.$inferSelect;
export type InsertOutreachDraft = typeof outreachDrafts.$inferInsert;

export const voiceProfiles = sqliteTable("voice_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  formality: text("formality").notNull(),
  directness: text("directness").notNull(),
  enthusiasm: text("enthusiasm").notNull(),
  avgSentenceLength: integer("avgSentenceLength").notNull(),
  avgParagraphLength: integer("avgParagraphLength").notNull(),
  usesContractions: integer("usesContractions", { mode: 'boolean' }).notNull(),
  usesEmoji: integer("usesEmoji", { mode: 'boolean' }).notNull(),
  usesProfanity: integer("usesProfanity", { mode: 'boolean' }).notNull(),
  commonPhrases: text("commonPhrases").notNull(), // JSON
  industryJargon: text("industryJargon").notNull(), // JSON
  signOffStyle: text("signOffStyle").notNull(),
  greetingStyle: text("greetingStyle").notNull(),
  usesLists: integer("usesLists", { mode: 'boolean' }).notNull(),
  usesBoldText: integer("usesBoldText", { mode: 'boolean' }).notNull(),
  usesQuestions: integer("usesQuestions", { mode: 'boolean' }).notNull(),
  exampleEmails: text("exampleEmails").notNull(), // JSON
  calibrationCount: integer("calibrationCount").default(0).notNull(),
  isCalibrated: integer("isCalibrated", { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type InsertVoiceProfile = typeof voiceProfiles.$inferInsert;

export const emailQueue = sqliteTable("email_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  campaignId: integer("campaignId"),
  draftId: integer("draftId"),
  recipientEmail: text("recipientEmail").notNull(),
  recipientName: text("recipientName"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("pending").notNull(),
  scheduledFor: integer("scheduledFor", { mode: 'timestamp' }),
  sentAt: integer("sentAt", { mode: 'timestamp' }),
  gmailMessageId: text("gmailMessageId"),
  gmailThreadId: text("gmailThreadId"),
  openedAt: integer("openedAt", { mode: 'timestamp' }),
  clickedAt: integer("clickedAt", { mode: 'timestamp' }),
  repliedAt: integer("repliedAt", { mode: 'timestamp' }),
  replyContent: text("replyContent"),
  errorMessage: text("errorMessage"),
  retryCount: integer("retryCount").default(0).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = typeof emailQueue.$inferInsert;

export const followUpSequences = sqliteTable("follow_up_sequences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  initialEmailId: integer("initialEmailId"),
  sequenceType: text("sequenceType").notNull(),
  currentStep: integer("currentStep").default(0).notNull(),
  maxSteps: integer("maxSteps").default(3).notNull(),
  status: text("status").default("active").notNull(),
  stopReason: text("stopReason"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type FollowUpSequence = typeof followUpSequences.$inferSelect;
export type InsertFollowUpSequence = typeof followUpSequences.$inferInsert;

export const pipelineJobs = sqliteTable("pipeline_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  status: text("status").default("pending").notNull(),
  currentStage: text("currentStage"),
  progressPercentage: integer("progressPercentage").default(0).notNull(),
  stagesCompleted: text("stagesCompleted"), // JSON
  errorMessage: text("errorMessage"),
  retryCount: integer("retryCount").default(0).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  completedAt: integer("completedAt", { mode: 'timestamp' }),
});

export type PipelineJob = typeof pipelineJobs.$inferSelect;
export type InsertPipelineJob = typeof pipelineJobs.$inferInsert;

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lead_id: integer("lead_id").notNull(),
  stripe_checkout_session_id: text("stripe_checkout_session_id").notNull().unique(),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status").default("pending").notNull(),
  package_type: text("package_type").notNull(),
  payment_link: text("payment_link"),
  created_at: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updated_at: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  completed_at: integer("completed_at", { mode: 'timestamp' }),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export const apiCalls = sqliteTable("api_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  leadId: integer("leadId"),
  service: text("service").notNull(),
  operation: text("operation").notNull(),
  tokensUsed: integer("tokensUsed"),
  estimatedCost: integer("estimatedCost").notNull(),
  requestData: text("requestData"),
  responseStatus: text("responseStatus").notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type ApiCall = typeof apiCalls.$inferSelect;
export type InsertApiCall = typeof apiCalls.$inferInsert;

export const userOnboarding = sqliteTable("user_onboarding", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  hasCompletedScraper: integer("hasCompletedScraper", { mode: 'boolean' }).default(false).notNull(),
  hasReviewedAudit: integer("hasReviewedAudit", { mode: 'boolean' }).default(false).notNull(),
  hasSentInvoice: integer("hasSentInvoice", { mode: 'boolean' }).default(false).notNull(),
  hasReceivedPayment: integer("hasReceivedPayment", { mode: 'boolean' }).default(false).notNull(),
  onboardingCompletedAt: integer("onboardingCompletedAt", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = typeof userOnboarding.$inferInsert;

export const aiProviders = sqliteTable("ai_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  displayName: text("displayName").notNull(),
  apiKey: text("apiKey"),
  isEnabled: integer("isEnabled", { mode: 'boolean' }).default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  maxRequestsPerMinute: integer("maxRequestsPerMinute"),
  maxTokensPerDay: integer("maxTokensPerDay"),
  costPer1kTokens: integer("costPer1kTokens"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type AIProvider = typeof aiProviders.$inferSelect;
export type InsertAIProvider = typeof aiProviders.$inferInsert;

export const apiUsageLogs = sqliteTable("api_usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("providerId").notNull(),
  userId: integer("userId"),
  leadId: integer("leadId"),
  operation: text("operation").notNull(),
  model: text("model"),
  promptTokens: integer("promptTokens").notNull(),
  completionTokens: integer("completionTokens").notNull(),
  totalTokens: integer("totalTokens").notNull(),
  cost: integer("cost"),
  latencyMs: integer("latencyMs"),
  success: integer("success", { mode: 'boolean' }).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type APIUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertAPIUsageLog = typeof apiUsageLogs.$inferInsert;

export const providerHealth = sqliteTable("provider_health", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("providerId").notNull().unique(),
  status: text("status").default("healthy").notNull(),
  lastSuccessAt: integer("lastSuccessAt", { mode: 'timestamp' }),
  lastFailureAt: integer("lastFailureAt", { mode: 'timestamp' }),
  consecutiveFailures: integer("consecutiveFailures").default(0).notNull(),
  avgLatencyMs: integer("avgLatencyMs"),
  successRate: integer("successRate"),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type ProviderHealth = typeof providerHealth.$inferSelect;
export type InsertProviderHealth = typeof providerHealth.$inferInsert;

export const technographicLeads = sqliteTable("technographic_leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  detected_cms: text("detected_cms"),
  has_pixel: integer("has_pixel", { mode: 'boolean' }).default(false),
  has_ga4: integer("has_ga4", { mode: 'boolean' }).default(false),
  ssl_error: integer("ssl_error", { mode: 'boolean' }).default(false),
  neglected: integer("neglected", { mode: 'boolean' }).default(false),
  last_scanned_at: integer("last_scanned_at", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

export type TechnographicLead = typeof technographicLeads.$inferSelect;
export type InsertTechnographicLead = typeof technographicLeads.$inferInsert;

export const outreachHistory = sqliteTable("outreach_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  userId: integer("userId").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  sentAt: integer("sentAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  metadata: text("metadata"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});



// ============================================
// Autonomous Sales System Tables
// ============================================

// --- Email Threads ---
export const emailThreads = sqliteTable("email_threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("leadId").notNull(),
  gmailThreadId: text("gmailThreadId").unique(),
  status: text("status", { enum: ["active", "closed_won", "closed_lost", "paused"] })
    .default("active")
    .notNull(),
  lastMessageAt: integer("lastMessageAt", { mode: 'timestamp' }),
  lastSender: text("lastSender", { enum: ["us", "them"] }),
  createdAt: integer("createdAt", { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = typeof emailThreads.$inferInsert;

// --- Individual Messages ---
export const emailMessages = sqliteTable("email_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("threadId")
    .notNull()
    .references(() => emailThreads.id, { onDelete: 'cascade' }),
  gmailMessageId: text("gmailMessageId").unique(),
  sender: text("sender", { enum: ["us", "them"] }).notNull(),
  subject: text("subject").notNull(),
  bodyText: text("bodyText").notNull(),
  bodyHtml: text("bodyHtml"),
  sentAt: integer("sentAt", { mode: 'timestamp' }).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = typeof emailMessages.$inferInsert;

// --- Intent Classification ---
export const intentClassifications = sqliteTable("intent_classifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("messageId")
    .notNull()
    .unique()
    .references(() => emailMessages.id, { onDelete: 'cascade' }),
  intent: text("intent", { enum: ["interested", "objection", "not_now", "spam", "unsubscribe"] }).notNull(),
  confidence: integer("confidence").notNull(),
  reasoning: text("reasoning"),
  createdAt: integer("createdAt", { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type IntentClassification = typeof intentClassifications.$inferSelect;
export type InsertIntentClassification = typeof intentClassifications.$inferInsert;

// --- AI Auto Responses ---
export const autoResponses = sqliteTable("auto_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("threadId")
    .notNull()
    .references(() => emailThreads.id, { onDelete: 'cascade' }),
  inReplyToMessageId: integer("inReplyToMessageId")
    .notNull()
    .references(() => emailMessages.id),
  subject: text("subject").notNull(),
  bodyText: text("bodyText").notNull(),
  bodyHtml: text("bodyHtml"),
  status: text("status", { enum: ["pending_approval", "approved", "sent", "rejected"] })
    .default("pending_approval")
    .notNull(),
  autoSendAt: integer("autoSendAt", { mode: 'timestamp' }),
  sentAt: integer("sentAt", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type AutoResponse = typeof autoResponses.$inferSelect;
export type InsertAutoResponse = typeof autoResponses.$inferInsert;

// --- Scheduled Follow-ups ---
export const scheduledFollowUps = sqliteTable("scheduled_follow_ups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("threadId")
    .notNull()
    .references(() => emailThreads.id, { onDelete: 'cascade' }),
  sequenceId: integer("sequenceId").notNull(),
  scheduledFor: integer("scheduledFor", { mode: 'timestamp' }).notNull(),
  status: text("status", { enum: ["pending", "sent", "cancelled"] })
    .default("pending")
    .notNull(),
  sentAt: integer("sentAt", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type ScheduledFollowUp = typeof scheduledFollowUps.$inferSelect;
export type InsertScheduledFollowUp = typeof scheduledFollowUps.$inferInsert;

// --- Relations ---
export const emailThreadRelations = relations(emailThreads, ({ many }) => ({
  messages: many(emailMessages),
  followUps: many(scheduledFollowUps),
}));

export const emailMessageRelations = relations(emailMessages, ({ one }) => ({
  thread: one(emailThreads, {
    fields: [emailMessages.threadId],
    references: [emailThreads.id],
  }),
  classification: one(intentClassifications, {
    fields: [emailMessages.id],
    references: [intentClassifications.messageId],
  }),
}));
