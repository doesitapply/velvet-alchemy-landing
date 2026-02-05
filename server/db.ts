
import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRequire } from "module";
import {
  users, leads, audits, assets, waitlist, payments, rateLimits,
  systemConfig, auditLog, campaigns, outreachDrafts, emailQueue,
  followUpSequences, pipelineJobs, apiCalls, userOnboarding,
  aiProviders, apiUsageLogs, providerHealth, outreachHistory,
  InsertUser, InsertLead, InsertAudit, InsertAsset, InsertWaitlist,
  InsertPayment, InsertRateLimit, InsertSystemConfig, InsertAuditLog,
  Lead, Audit, Asset, RateLimit, SystemConfig, AuditLog,
  Campaign, OutreachDraft, EmailQueue, FollowUpSequence, PipelineJob,
  Payment, ApiCall, UserOnboarding, AIProvider, APIUsageLog, ProviderHealth
} from "../drizzle/schema";
import { ENV } from './_core/env';

// ----------------------------------------------------------------------------
// SQLITE DATABASE CONNECTION (DEV ONLY)
// ----------------------------------------------------------------------------
// Vercel/serverless environments are not compatible with native better-sqlite3
// (and local disk is not durable). For production money-paths, we use Supabase.
const isProd = process.env.NODE_ENV === "production";

let sqlite: any = null;
export const db: any = (() => {
  if (isProd) return null;

  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require("better-sqlite3");

  sqlite = new Database("velvet_alchemy.db");
  return drizzle(sqlite);
})();

// Initialize DB with tables if they don't exist (Basic Migration)
const runMigrations = () => {
  if (!sqlite) {
    console.log("[DB] Skipping SQLite migrations (production/serverless mode)");
    return;
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, openId TEXT NOT NULL UNIQUE, name TEXT, email TEXT, loginMethod TEXT, role TEXT NOT NULL DEFAULT 'user', createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()), lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, companyName TEXT NOT NULL, websiteUrl TEXT NOT NULL, screenshotUrl TEXT, screenshotKey TEXT, status TEXT NOT NULL DEFAULT 'pending', prestigeScore INTEGER, priorityScore INTEGER, hasAssets INTEGER NOT NULL DEFAULT 0, assetsStatus TEXT NOT NULL DEFAULT 'not_requested', assetsGeneratedAt INTEGER, hasOutreach INTEGER NOT NULL DEFAULT 0, detailedReport TEXT, lastDeepScanAt INTEGER, monthlyVisits INTEGER, globalRank INTEGER, bounceRate REAL, trafficDataFetchedAt INTEGER, contactEmail TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS audits (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, summary TEXT, prestigeScore INTEGER, visualDebtData TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS assets (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, type TEXT NOT NULL, url TEXT NOT NULL, s3Key TEXT NOT NULL, metadata TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS pipeline_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', currentStage TEXT, progressPercentage INTEGER NOT NULL DEFAULT 0, stagesCompleted TEXT, errorMessage TEXT, retryCount INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()), completedAt INTEGER);
    CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, stripe_checkout_session_id TEXT NOT NULL UNIQUE, stripe_payment_intent_id TEXT, amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'usd', status TEXT NOT NULL DEFAULT 'pending', package_type TEXT NOT NULL, payment_link TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()), completed_at INTEGER);
    CREATE TABLE IF NOT EXISTS outreach_history (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, userId INTEGER NOT NULL, type TEXT NOT NULL, content TEXT, sentAt INTEGER NOT NULL DEFAULT (unixepoch()), metadata TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, targetNiche TEXT, status TEXT NOT NULL DEFAULT 'pending', createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS rate_limits (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, action TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, windowStart INTEGER NOT NULL, windowEnd INTEGER NOT NULL, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS system_config (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL, description TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, action TEXT NOT NULL, resource TEXT, resourceId INTEGER, details TEXT, ipAddress TEXT, userAgent TEXT, status TEXT NOT NULL, createdAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, userId INTEGER NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', sentAt INTEGER, openedAt INTEGER, clickedAt INTEGER, repliedAt INTEGER, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS outreach_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, campaignId INTEGER NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, recipientEmail TEXT NOT NULL, recipientName TEXT, status TEXT NOT NULL DEFAULT 'draft', rejectionReason TEXT, approvedBy INTEGER, approvedAt INTEGER, sentAt INTEGER, gmailMessageId TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS voice_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL UNIQUE, formality TEXT NOT NULL, directness TEXT NOT NULL, enthusiasm TEXT NOT NULL, avgSentenceLength INTEGER NOT NULL, avgParagraphLength INTEGER NOT NULL, usesContractions INTEGER NOT NULL, usesEmoji INTEGER NOT NULL, usesProfanity INTEGER NOT NULL, commonPhrases TEXT NOT NULL, industryJargon TEXT NOT NULL, signOffStyle TEXT NOT NULL, greetingStyle TEXT NOT NULL, usesLists INTEGER NOT NULL, usesBoldText INTEGER NOT NULL, usesQuestions INTEGER NOT NULL, exampleEmails TEXT NOT NULL, calibrationCount INTEGER NOT NULL DEFAULT 0, isCalibrated INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS email_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, campaignId INTEGER, draftId INTEGER, recipientEmail TEXT NOT NULL, recipientName TEXT, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', scheduledFor INTEGER, sentAt INTEGER, gmailMessageId TEXT, gmailThreadId TEXT, openedAt INTEGER, clickedAt INTEGER, repliedAt INTEGER, replyContent TEXT, errorMessage TEXT, retryCount INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS follow_up_sequences (id INTEGER PRIMARY KEY AUTOINCREMENT, leadId INTEGER NOT NULL, initialEmailId INTEGER, sequenceType TEXT NOT NULL, currentStep INTEGER NOT NULL DEFAULT 0, maxSteps INTEGER NOT NULL DEFAULT 3, status TEXT NOT NULL DEFAULT 'active', stopReason TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS api_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, leadId INTEGER, service TEXT NOT NULL, operation TEXT NOT NULL, tokensUsed INTEGER, estimatedCost INTEGER NOT NULL, requestData TEXT, responseStatus TEXT NOT NULL, createdAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS user_onboarding (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL UNIQUE, hasCompletedScraper INTEGER NOT NULL DEFAULT 0, hasReviewedAudit INTEGER NOT NULL DEFAULT 0, hasSentInvoice INTEGER NOT NULL DEFAULT 0, hasReceivedPayment INTEGER NOT NULL DEFAULT 0, onboardingCompletedAt INTEGER, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS ai_providers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, displayName TEXT NOT NULL, apiKey TEXT, isEnabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0, maxRequestsPerMinute INTEGER, maxTokensPerDay INTEGER, costPer1kTokens INTEGER, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS api_usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, providerId INTEGER NOT NULL, userId INTEGER, leadId INTEGER, operation TEXT NOT NULL, model TEXT, promptTokens INTEGER NOT NULL, completionTokens INTEGER NOT NULL, totalTokens INTEGER NOT NULL, cost INTEGER, latencyMs INTEGER, success INTEGER NOT NULL, errorMessage TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS provider_health (id INTEGER PRIMARY KEY AUTOINCREMENT, providerId INTEGER NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'healthy', lastSuccessAt INTEGER, lastFailureAt INTEGER, consecutiveFailures INTEGER NOT NULL DEFAULT 0, avgLatencyMs INTEGER, successRate INTEGER, updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS technographic_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, detected_cms TEXT, has_pixel INTEGER DEFAULT 0, has_ga4 INTEGER DEFAULT 0, ssl_error INTEGER DEFAULT 0, neglected INTEGER DEFAULT 0, last_scanned_at INTEGER, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()));
    `);
  console.log("[DB] SQLite tables initialized/verified.");
};

runMigrations();

// Ensure a stable SYSTEM user exists (id=1) so local dev lead intake can work without auth.
if (sqlite) {
  try {
    const row = sqlite.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
    if (!row) {
      sqlite
        .prepare(
          "INSERT INTO users (openId, name, email, loginMethod, role) VALUES (?, ?, ?, ?, ?)"
        )
        .run("system", "Velvet Alchemy", "madeinreno775@gmail.com", "system", "admin");
      console.log("[DB] Seeded system user (openId=system)");
    }
  } catch (e) {
    console.warn("[DB] Failed to seed system user", e);
  }
}

export async function getDb() {
  return db;
}

// ----------------------------------------------------------------------------
// DATABASE HELPER FUNCTIONS (Now using Real DB)
// ----------------------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<void> {
  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).get();

  if (existing) {
    await db.update(users).set({
      ...user,
      lastSignedIn: new Date(),
      updatedAt: new Date()
    }).where(eq(users.openId, user.openId));
  } else {
    // First user is admin
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(users).get();
    const count = countResult?.count ?? 0;
    const role = count === 0 ? 'admin' : (user.role || 'user');
    await db.insert(users).values({ ...user, role });
  }
}

export async function getUserByOpenId(openId: string) {
  return db.select().from(users).where(eq(users.openId, openId)).get();
}

export async function addToWaitlist(email: string, targetNiche?: string) {
  try {
    const existing = await db.select().from(waitlist).where(eq(waitlist.email, email)).get();
    if (existing) return { success: true, message: "Email already registered" };

    await db.insert(waitlist).values({ email, targetNiche });
    return { success: true, message: "Successfully added to waitlist" };
  } catch (e) {
    return { success: false, message: "Failed to add to waitlist" };
  }
}

export async function getWaitlistEntries() {
  return db.select().from(waitlist).all();
}

export async function createLead(lead: InsertLead) {
  const result = await db.insert(leads).values(lead).returning().get();
  console.log(`[DB] Created lead: ${result.companyName} (ID: ${result.id})`);
  return result;
}

export async function getLeadsByUserId(userId: number) {
  return db.select().from(leads)
    .where(eq(leads.userId, userId))
    .orderBy(desc(leads.prestigeScore))
    .all();
}

export async function getAllLeads() {
  return db.select().from(leads).orderBy(desc(leads.createdAt)).all();
}

export async function getLeadById(id: number) {
  return db.select().from(leads).where(eq(leads.id, id)).get() || null;
}

export async function updateLead(id: number, updates: Partial<InsertLead>) {
  const result = await db.update(leads)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning()
    .get();
  return result || null;
}

export async function deleteLead(id: number) {
  const result = await db.delete(leads).where(eq(leads.id, id)).run();
  return result.changes > 0;
}

export async function createAudit(audit: InsertAudit) {
  return db.insert(audits).values(audit).returning().get();
}

export async function getAuditByLeadId(leadId: number) {
  return db.select().from(audits).where(eq(audits.leadId, leadId)).get() || null;
}

export async function updateLeadAssetsStatus(id: number, status: string, generatedAt?: Date) {
  const updateData: any = { assetsStatus: status };
  if (generatedAt) updateData.assetsGeneratedAt = generatedAt;
  if (status === 'ready') updateData.hasAssets = true;

  await db.update(leads).set(updateData).where(eq(leads.id, id));
}

export async function createPaymentRecord(data: Omit<InsertPayment, "id" | "created_at" | "updated_at">) {
  return db.insert(payments).values(data).returning().get();
}

export async function getPaymentsByLeadId(leadId: number) {
  return db.select().from(payments).where(eq(payments.lead_id, leadId)).orderBy(desc(payments.created_at)).all();
}

export async function getPaymentsByUserId(userId: number) {
  const result = await db.select({
    payment: payments,
    companyName: leads.companyName,
    websiteUrl: leads.websiteUrl
  })
    .from(payments)
    .innerJoin(leads, eq(payments.lead_id, leads.id))
    .where(eq(leads.userId, userId))
    .orderBy(desc(payments.created_at))
    .all();

  return result.map(r => ({
    ...r.payment,
    companyName: r.companyName,
    websiteUrl: r.websiteUrl
  }));
}

export async function getPaymentBySessionId(sessionId: string) {
  return db.select().from(payments).where(eq(payments.stripe_checkout_session_id, sessionId)).get();
}

export async function updatePaymentBySessionId(sessionId: string, updates: Partial<InsertPayment>) {
  await db.update(payments).set({ ...updates, updated_at: new Date() }).where(eq(payments.stripe_checkout_session_id, sessionId));
}

export async function getAllPayments() {
  return db.select().from(payments).all();
}

export async function getSystemConfigEntries() {
  return db.select().from(systemConfig).all();
}

export async function getSystemConfigValue(key: string) {
  return db.select().from(systemConfig).where(eq(systemConfig.key, key)).get();
}

export async function setSystemConfigValue(key: string, value: string, description?: string) {
  const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).get();
  if (existing) {
    return db.update(systemConfig)
      .set({ value, description, updatedAt: new Date() })
      .where(eq(systemConfig.key, key))
      .returning()
      .get();
  }
  return db.insert(systemConfig).values({ key, value, description }).returning().get();
}

export async function deleteSystemConfigKey(key: string) {
  await db.delete(systemConfig).where(eq(systemConfig.key, key));
}

export async function findActiveRateLimit(userId: number, action: string, now: Date) {
  return db.select().from(rateLimits)
    .where(sql`${rateLimits.userId} = ${userId} AND ${rateLimits.action} = ${action} AND ${rateLimits.windowEnd} >= ${now}`)
    .get();
}

export async function createRateLimitRecord(entry: Omit<InsertRateLimit, "id" | "createdAt" | "updatedAt">) {
  return db.insert(rateLimits).values(entry).returning().get();
}

export async function incrementRateLimitRecord(recordId: number) {
  await db.update(rateLimits)
    .set({ count: sql`count + 1`, updatedAt: new Date() })
    .where(eq(rateLimits.id, recordId));
}

export async function getRateLimitRecords() {
  return db.select().from(rateLimits).all();
}

export async function insertAuditLogEntry(entry: InsertAuditLog) {
  await db.insert(auditLog).values(entry);
}

export async function getAuditLogEntries(limit = 20) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).all();
}

export async function clearMockStore() {
  console.log("[DB] Clearing real database...");
  await db.delete(leads);
  await db.delete(audits);
  await db.delete(assets);
  await db.delete(payments);
  await db.delete(auditLog);
}

export async function getDbForScraper() {
  return db;
}
