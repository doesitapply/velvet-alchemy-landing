import {
  boolean,
  decimal,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Waitlist for access requests
export const waitlist = mysqlTable("waitlist", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  targetNiche: varchar("targetNiche", { length: 255 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

// Leads table for The Curator
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Owner of this lead
  companyName: varchar("companyName", { length: 255 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 512 }).notNull(),
  screenshotUrl: varchar("screenshotUrl", { length: 512 }),
  screenshotKey: varchar("screenshotKey", { length: 512 }), // S3 key for deletion
  status: mysqlEnum("status", ["pending", "audited", "contacted", "closed", "paid", "smirk_queued", "smirk_contacted"]).default("pending").notNull(),
  prestigeScore: int("prestigeScore"), // 0-100, copied from audit for quick access
  priorityScore: int("priorityScore"), // 0-100, pre-screening score for lead value (domain age, SSL, mobile, etc.)
  hasAssets: boolean("hasAssets").default(false).notNull(), // True if Visionary generated assets
  assetsStatus: mysqlEnum("assetsStatus", ["not_requested", "generating", "ready", "failed"]).default("not_requested").notNull(),
  assetsGeneratedAt: timestamp("assetsGeneratedAt"), // When assets were last generated
  hasOutreach: boolean("hasOutreach").default(false).notNull(), // True if Charmer sent outreach
  detailedReport: text("detailedReport"), // JSON string for technical leak detection data
  lastDeepScanAt: timestamp("lastDeepScanAt"), // Timestamp of last enrichment scan
  // Traffic data from SimilarWeb
  monthlyVisits: int("monthlyVisits"), // Estimated monthly visitors
  globalRank: int("globalRank"), // Global traffic ranking
  bounceRate: decimal("bounceRate", { precision: 5, scale: 2 }), // Bounce rate percentage
  trafficDataFetchedAt: timestamp("trafficDataFetchedAt"), // When traffic data was last fetched
  // Outreach routing fields (set by enrichment pipeline)
  outreachChannel: mysqlEnum("outreachChannel", ["email", "sms", "none"]).default("none").notNull(),
  verifiedOwnerEmail: varchar("verifiedOwnerEmail", { length: 320 }), // Verified owner email from the enabled enrichment adapter
  // SMIRK handoff tracking
  smirkHandoffAt: timestamp("smirkHandoffAt"),
  smirkCallOutcome: varchar("smirkCallOutcome", { length: 64 }),
  smirkCallSummary: text("smirkCallSummary"),
  smirkWorkspaceId: varchar("smirkWorkspaceId", { length: 128 }),
  // Google Maps enrichment fields
  phone: varchar("phone", { length: 32 }),
  address: varchar("address", { length: 512 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  googleRating: decimal("googleRating", { precision: 3, scale: 1 }),
  reviewCount: int("reviewCount"),
  reviewSnippets: text("reviewSnippets"), // JSON array of up to 3 review texts
  googlePlaceId: varchar("googlePlaceId", { length: 255 }),
  businessStatus: varchar("businessStatus", { length: 64 }), // OPERATIONAL, CLOSED_TEMPORARILY, etc.
  category: varchar("category", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// Audits table for The Curator
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  summary: text("summary"), // Placeholder for now, will be LLM-generated later
  prestigeScore: int("prestigeScore"), // 0-100, null for MVP
  visualDebtData: text("visualDebtData"), // JSON string for structured audit data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

/**
 * Rate limiting table to track API usage per user
 */
export const rateLimits = mysqlTable("rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(), // e.g., 'lead_create', 'audit_run'
  count: int("count").notNull().default(0),
  windowStart: timestamp("windowStart").notNull(),
  windowEnd: timestamp("windowEnd").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = typeof rateLimits.$inferInsert;

/**
 * System configuration for kill-switch and global settings
 */
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

/**
 * Audit log for compliance and debugging
 */
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 64 }).notNull(),
  resource: varchar("resource", { length: 64 }),
  resourceId: int("resourceId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  status: mysqlEnum("status", ["success", "failure", "blocked"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

/**
 * Idempotent, signed outcome events received from SMIRK.
 * These are feedback facts for evaluation; they never auto-send or auto-promote policy.
 */
export const smirkOutcomeEvents = mysqlTable("smirk_outcome_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  externalProspectId: varchar("externalProspectId", { length: 160 }).notNull(),
  externalEventId: varchar("externalEventId", { length: 160 })
    .notNull()
    .unique(),
  outreachApprovalId: varchar("outreachApprovalId", { length: 64 }).notNull(),
  channel: mysqlEnum("channel", ["email", "call"]).notNull(),
  outcome: mysqlEnum("outcome", [
    "delivered",
    "bounced",
    "replied",
    "qualified",
    "demo_booked",
    "converted",
    "not_interested",
    "dnc",
    "call_connected",
    "voicemail",
    "no_answer",
    "failed",
  ]).notNull(),
  evidenceHash: varchar("evidenceHash", { length: 64 }).notNull(),
  outreachPayloadHash: varchar("outreachPayloadHash", {
    length: 64,
  }).notNull(),
  eventPayloadHash: varchar("eventPayloadHash", { length: 64 }).notNull(),
  notes: text("notes"),
  occurredAt: timestamp("occurredAt").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});

export type SmirkOutcomeEvent = typeof smirkOutcomeEvents.$inferSelect;
export type InsertSmirkOutcomeEvent = typeof smirkOutcomeEvents.$inferInsert;

/**
 * Immutable, owner-scoped receipts for reviewed lead batches exported to SMIRK.
 * These rows reserve leads for research review only; they never authorize contact.
 */
export const smirkLeadBatches = mysqlTable(
  "smirk_lead_batches",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    requestId: varchar("requestId", { length: 160 }).notNull(),
    workspaceId: int("workspaceId").notNull(),
    requestedByApiKeyId: int("requestedByApiKeyId").notNull(),
    requestedByApiKeyName: varchar("requestedByApiKeyName", {
      length: 100,
    }).notNull(),
    requestPayload: text("requestPayload").notNull(),
    requestPayloadHash: varchar("requestPayloadHash", {
      length: 64,
    }).notNull(),
    state: mysqlEnum("state", ["PROCESSING", "EXPORTED", "EMPTY"])
      .default("PROCESSING")
      .notNull(),
    responsePayload: mediumtext("responsePayload"),
    responsePayloadHash: varchar("responsePayloadHash", { length: 64 }),
    appliedLearningCandidateId: int("appliedLearningCandidateId"),
    leadCount: int("leadCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => ({
    requestUnique: uniqueIndex("smirk_lead_batches_request_unique").on(
      table.requestId
    ),
  })
);

export type SmirkLeadBatch = typeof smirkLeadBatches.$inferSelect;
export type InsertSmirkLeadBatch = typeof smirkLeadBatches.$inferInsert;

export const smirkLeadBatchItems = mysqlTable(
  "smirk_lead_batch_items",
  {
    id: int("id").autoincrement().primaryKey(),
    batchId: int("batchId").notNull(),
    userId: int("userId").notNull(),
    leadId: int("leadId").notNull(),
    ordinal: int("ordinal").notNull(),
    prospectPayloadHash: varchar("prospectPayloadHash", {
      length: 64,
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerLeadUnique: uniqueIndex(
      "smirk_lead_batch_items_owner_lead_unique"
    ).on(table.userId, table.leadId),
    batchOrdinalUnique: uniqueIndex(
      "smirk_lead_batch_items_batch_ordinal_unique"
    ).on(table.batchId, table.ordinal),
  })
);

export type SmirkLeadBatchItem = typeof smirkLeadBatchItems.$inferSelect;
export type InsertSmirkLeadBatchItem =
  typeof smirkLeadBatchItems.$inferInsert;

/**
 * Frozen, owner-scoped source-allocation experiments. Preparing or activating
 * one only governs future discovery assignment; it grants no provider spend or
 * prospect-contact authority.
 */
export const acquisitionSourcingExperiments = mysqlTable(
  "acquisition_sourcing_experiments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    experimentId: varchar("experimentId", { length: 64 }).notNull(),
    workspaceId: int("workspaceId").notNull(),
    state: mysqlEnum("state", ["PREPARED", "ACTIVE", "CLOSED", "CANCELLED"])
      .default("PREPARED")
      .notNull(),
    definition: mediumtext("definition").notNull(),
    definitionHash: varchar("definitionHash", { length: 64 }).notNull(),
    resultPayload: mediumtext("resultPayload"),
    resultPayloadHash: varchar("resultPayloadHash", { length: 64 }),
    learningCandidateId: int("learningCandidateId"),
    preparedBy: int("preparedBy").notNull(),
    activatedBy: int("activatedBy"),
    activatedAt: timestamp("activatedAt"),
    closedBy: int("closedBy"),
    closedAt: timestamp("closedAt"),
    cancelledBy: int("cancelledBy"),
    cancelledAt: timestamp("cancelledAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    experimentIdUnique: uniqueIndex(
      "acquisition_sourcing_experiments_experiment_id_unique"
    ).on(table.experimentId),
    ownerWorkspaceStateIndex: index(
      "acquisition_sourcing_experiments_owner_workspace_state_idx"
    ).on(table.userId, table.workspaceId, table.state),
  })
);

export type AcquisitionSourcingExperiment =
  typeof acquisitionSourcingExperiments.$inferSelect;
export type InsertAcquisitionSourcingExperiment =
  typeof acquisitionSourcingExperiments.$inferInsert;

export const acquisitionSourcingExperimentEvents = mysqlTable(
  "acquisition_sourcing_experiment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    experimentRowId: int("experimentRowId").notNull(),
    userId: int("userId").notNull(),
    actorId: int("actorId").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    fromState: varchar("fromState", { length: 32 }),
    toState: varchar("toState", { length: 32 }).notNull(),
    payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
    details: text("details").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    experimentCreatedIndex: index(
      "acquisition_sourcing_experiment_events_experiment_created_idx"
    ).on(table.experimentRowId, table.createdAt),
  })
);

export type AcquisitionSourcingExperimentEvent =
  typeof acquisitionSourcingExperimentEvents.$inferSelect;
export type InsertAcquisitionSourcingExperimentEvent =
  typeof acquisitionSourcingExperimentEvents.$inferInsert;

/**
 * Approval-gated discovery requests originating from SMIRK.
 * The external request can only prepare a quote. A Velvet administrator must
 * separately approve and queue the exact request before any provider call.
 */
export const smirkDiscoveryRequests = mysqlTable(
  "smirk_discovery_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    requestId: varchar("requestId", { length: 160 }).notNull(),
    workspaceId: int("workspaceId").notNull(),
    requestedByApiKeyId: int("requestedByApiKeyId").notNull(),
    requestedByApiKeyName: varchar("requestedByApiKeyName", {
      length: 100,
    }).notNull(),
    requestPayload: mediumtext("requestPayload").notNull(),
    requestPayloadHash: varchar("requestPayloadHash", {
      length: 64,
    }).notNull(),
    effectiveCriteria: text("effectiveCriteria").notNull(),
    effectiveCriteriaHash: varchar("effectiveCriteriaHash", {
      length: 64,
    }).notNull(),
    acquisitionSourcingExperimentId: int("acquisitionSourcingExperimentId"),
    acquisitionSourcingSlotOrdinal: int("acquisitionSourcingSlotOrdinal"),
    acquisitionSourcingArm: mysqlEnum("acquisitionSourcingArm", [
      "control",
      "challenger",
    ]),
    acquisitionSourcingAssignmentPayload: text(
      "acquisitionSourcingAssignmentPayload"
    ),
    acquisitionSourcingAssignmentHash: varchar(
      "acquisitionSourcingAssignmentHash",
      { length: 64 }
    ),
    appliedLearningCandidateId: int("appliedLearningCandidateId"),
    appliedLearningCandidatePayload: text("appliedLearningCandidatePayload"),
    quotePayload: text("quotePayload").notNull(),
    quotePayloadHash: varchar("quotePayloadHash", { length: 64 }).notNull(),
    state: mysqlEnum("state", [
      "PREPARED",
      "APPROVED",
      "QUEUED",
      "RUNNING",
      "COMPLETED",
      "EMPTY",
      "PARTIAL",
      "FAILED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
    ])
      .default("PREPARED")
      .notNull(),
    approvalPayloadHash: varchar("approvalPayloadHash", { length: 64 }),
    approvedMaxSpendCents: int("approvedMaxSpendCents"),
    approvedBy: int("approvedBy"),
    approvedAt: timestamp("approvedAt"),
    expiresAt: timestamp("expiresAt").notNull(),
    queuedBy: int("queuedBy"),
    queuedAt: timestamp("queuedAt"),
    executionToken: varchar("executionToken", { length: 64 }),
    leaseExpiresAt: timestamp("leaseExpiresAt"),
    providerRequests: int("providerRequests").default(0).notNull(),
    createdLeadCount: int("createdLeadCount").default(0).notNull(),
    readyLeadCount: int("readyLeadCount").default(0).notNull(),
    skippedLeadCount: int("skippedLeadCount").default(0).notNull(),
    failedLeadCount: int("failedLeadCount").default(0).notNull(),
    resultPayload: mediumtext("resultPayload"),
    resultPayloadHash: varchar("resultPayloadHash", { length: 64 }),
    error: text("error"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => ({
    requestUnique: uniqueIndex("smirk_discovery_requests_request_unique").on(
      table.requestId
    ),
    stateCreatedIndex: index("smirk_discovery_requests_state_created_idx").on(
      table.state,
      table.createdAt
    ),
    experimentSlotUnique: uniqueIndex(
      "smirk_discovery_requests_experiment_slot_unique"
    ).on(
      table.acquisitionSourcingExperimentId,
      table.acquisitionSourcingSlotOrdinal
    ),
  })
);

export type SmirkDiscoveryRequestRecord =
  typeof smirkDiscoveryRequests.$inferSelect;
export type InsertSmirkDiscoveryRequestRecord =
  typeof smirkDiscoveryRequests.$inferInsert;

export const smirkDiscoveryLeadItems = mysqlTable(
  "smirk_discovery_lead_items",
  {
    id: int("id").autoincrement().primaryKey(),
    discoveryId: int("discoveryId").notNull(),
    userId: int("userId").notNull(),
    sourcePlaceId: varchar("sourcePlaceId", { length: 255 }).notNull(),
    leadId: int("leadId"),
    state: mysqlEnum("state", ["CREATED", "READY", "SKIPPED", "FAILED"])
      .notNull(),
    sourcePayloadHash: varchar("sourcePayloadHash", { length: 64 }).notNull(),
    error: text("error"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    discoveryPlaceUnique: uniqueIndex(
      "smirk_discovery_lead_items_discovery_place_unique"
    ).on(table.discoveryId, table.sourcePlaceId),
    discoveryStateIndex: index(
      "smirk_discovery_lead_items_discovery_state_idx"
    ).on(table.discoveryId, table.state),
  })
);

export type SmirkDiscoveryLeadItem =
  typeof smirkDiscoveryLeadItems.$inferSelect;
export type InsertSmirkDiscoveryLeadItem =
  typeof smirkDiscoveryLeadItems.$inferInsert;

export const smirkDiscoveryEvents = mysqlTable(
  "smirk_discovery_events",
  {
    id: int("id").autoincrement().primaryKey(),
    discoveryId: int("discoveryId").notNull(),
    userId: int("userId").notNull(),
    actorType: mysqlEnum("actorType", [
      "smirk_api",
      "velvet_user",
      "worker",
      "system",
    ]).notNull(),
    actorId: varchar("actorId", { length: 160 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    fromState: varchar("fromState", { length: 32 }),
    toState: varchar("toState", { length: 32 }).notNull(),
    payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
    details: text("details").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    discoveryCreatedIndex: index(
      "smirk_discovery_events_discovery_created_idx"
    ).on(table.discoveryId, table.createdAt),
  })
);

export type SmirkDiscoveryEvent =
  typeof smirkDiscoveryEvents.$inferSelect;
export type InsertSmirkDiscoveryEvent =
  typeof smirkDiscoveryEvents.$inferInsert;

/**
 * Human-review proposals derived from outcome-linked sourcing segments.
 * Decisions are evidence records only and never trigger scraping or outreach.
 */
export const acquisitionLearningCandidates = mysqlTable(
  "acquisition_learning_candidates",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    candidateKey: varchar("candidateKey", { length: 180 }).notNull(),
    version: int("version").notNull(),
    state: mysqlEnum("state", ["CANDIDATE", "APPROVED", "REJECTED"])
      .default("CANDIDATE")
      .notNull(),
    proposal: text("proposal").notNull(),
    evidence: text("evidence").notNull(),
    sampleSize: int("sampleSize").notNull(),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
    decidedBy: int("decidedBy"),
    decidedAt: timestamp("decidedAt"),
  },
  table => ({
    candidateVersionUnique: uniqueIndex(
      "acquisition_learning_candidates_user_key_version_unique"
    ).on(table.userId, table.candidateKey, table.version),
  })
);

export type AcquisitionLearningCandidate =
  typeof acquisitionLearningCandidates.$inferSelect;
export type InsertAcquisitionLearningCandidate =
  typeof acquisitionLearningCandidates.$inferInsert;

/**
 * Append-only authority receipts for the sourcing policy used by SMIRK.
 * Candidate approval alone never changes discovery or lead-batch filters.
 */
export const acquisitionLearningPolicyReleases = mysqlTable(
  "acquisition_learning_policy_releases",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    releaseId: varchar("releaseId", { length: 64 }).notNull(),
    action: mysqlEnum("action", ["APPLY", "DEACTIVATE"]).notNull(),
    activeCandidateId: int("activeCandidateId"),
    previousCandidateId: int("previousCandidateId"),
    candidateKey: varchar("candidateKey", { length: 180 }),
    candidateVersion: int("candidateVersion"),
    proposalHash: varchar("proposalHash", { length: 64 }),
    evidenceHash: varchar("evidenceHash", { length: 64 }),
    requestHash: varchar("requestHash", { length: 64 }).notNull(),
    receiptHash: varchar("receiptHash", { length: 64 }).notNull(),
    reason: text("reason").notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    releaseIdUnique: uniqueIndex(
      "acquisition_learning_policy_releases_release_id_unique"
    ).on(table.releaseId),
    userReleaseIndex: index(
      "acquisition_learning_policy_releases_user_id_idx"
    ).on(table.userId, table.id),
  })
);

export type AcquisitionLearningPolicyRelease =
  typeof acquisitionLearningPolicyReleases.$inferSelect;
export type InsertAcquisitionLearningPolicyRelease =
  typeof acquisitionLearningPolicyReleases.$inferInsert;

/**
 * Assets table for The Visionary
 */
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  type: mysqlEnum("type", ["hero_header", "social_post", "web_banner"]).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  metadata: text("metadata"), // JSON string for additional info (prompt, dimensions, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

/**
 * Campaigns table for tracking outreach campaigns
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "pending_approval", "approved", "sent", "failed"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

/**
 * Outreach drafts table for storing generated email copy
 */
export const outreachDrafts = mysqlTable("outreach_drafts", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  recipientName: varchar("recipientName", { length: 255 }),
  status: mysqlEnum("status", ["draft", "pending_approval", "approved", "rejected", "sent"]).default("draft").notNull(),
  rejectionReason: text("rejectionReason"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  sentAt: timestamp("sentAt"),
  gmailMessageId: varchar("gmailMessageId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OutreachDraft = typeof outreachDrafts.$inferSelect;
export type InsertOutreachDraft = typeof outreachDrafts.$inferInsert;

/**
 * Voice profiles table for storing user's writing style
 */
export const voiceProfiles = mysqlTable("voice_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // One profile per user
  formality: mysqlEnum("formality", ["casual", "professional", "technical", "mixed"]).notNull(),
  directness: mysqlEnum("directness", ["blunt", "direct", "diplomatic", "verbose"]).notNull(),
  enthusiasm: mysqlEnum("enthusiasm", ["high", "moderate", "low", "neutral"]).notNull(),
  avgSentenceLength: int("avgSentenceLength").notNull(),
  avgParagraphLength: int("avgParagraphLength").notNull(),
  usesContractions: boolean("usesContractions").notNull(),
  usesEmoji: boolean("usesEmoji").notNull(),
  usesProfanity: boolean("usesProfanity").notNull(),
  commonPhrases: text("commonPhrases").notNull(), // JSON array
  industryJargon: text("industryJargon").notNull(), // JSON array
  signOffStyle: varchar("signOffStyle", { length: 100 }).notNull(),
  greetingStyle: varchar("greetingStyle", { length: 100 }).notNull(),
  usesLists: boolean("usesLists").notNull(),
  usesBoldText: boolean("usesBoldText").notNull(),
  usesQuestions: boolean("usesQuestions").notNull(),
  exampleEmails: text("exampleEmails").notNull(), // JSON array of example emails
  calibrationCount: int("calibrationCount").default(0).notNull(), // Number of emails reviewed
  isCalibrated: boolean("isCalibrated").default(false).notNull(), // True after 5+ approvals
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type InsertVoiceProfile = typeof voiceProfiles.$inferInsert;

/**
 * Email queue for automated outreach
 */
export const emailQueue = mysqlTable("email_queue", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "cascade" }),
  draftId: int("draftId").references(() => outreachDrafts.id, { onDelete: "cascade" }),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  recipientName: varchar("recipientName", { length: 255 }),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["pending", "pending_approval", "approved", "sending", "sent", "failed", "bounced"]).default("pending").notNull(),
  scheduledFor: timestamp("scheduledFor"), // When to send (for follow-ups)
  sentAt: timestamp("sentAt"),
  gmailMessageId: varchar("gmailMessageId", { length: 255 }),
  gmailThreadId: varchar("gmailThreadId", { length: 255 }),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  repliedAt: timestamp("repliedAt"),
  replyContent: text("replyContent"),
  errorMessage: text("errorMessage"),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = typeof emailQueue.$inferInsert;

/**
 * Follow-up sequences for automated nurture
 */
export const followUpSequences = mysqlTable("follow_up_sequences", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  initialEmailId: int("initialEmailId").references(() => emailQueue.id),
  sequenceType: mysqlEnum("sequenceType", ["cold_outreach", "demo_follow_up", "proposal_follow_up", "nurture"]).notNull(),
  currentStep: int("currentStep").default(0).notNull(), // 0 = initial email, 1+ = follow-ups
  maxSteps: int("maxSteps").default(3).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed", "stopped"]).default("active").notNull(),
  stopReason: varchar("stopReason", { length: 100 }), // 'replied', 'unsubscribed', 'bounced', 'manual_stop'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FollowUpSequence = typeof followUpSequences.$inferSelect;
export type InsertFollowUpSequence = typeof followUpSequences.$inferInsert;

/**
 * Pipeline jobs table for The Orchestrator
 */
export const pipelineJobs = mysqlTable("pipeline_jobs", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  currentStage: varchar("currentStage", { length: 50 }),
  progressPercentage: int("progressPercentage").default(0).notNull(), // 0-100
  stagesCompleted: text("stagesCompleted"), // JSON array of completed stages
  errorMessage: text("errorMessage"),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type PipelineJob = typeof pipelineJobs.$inferSelect;
export type InsertPipelineJob = typeof pipelineJobs.$inferInsert;
/**
 * Payments table for Stripe checkout sessions
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  lead_id: int("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  stripe_checkout_session_id: varchar("stripe_checkout_session_id", { length: 255 }).notNull().unique(),
  stripe_payment_intent_id: varchar("stripe_payment_intent_id", { length: 255 }),
  amount: int("amount").notNull(), // Amount in cents
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  status: mysqlEnum("status", ["pending", "completed", "failed", "expired"]).default("pending").notNull(),
  package_type: mysqlEnum("package_type", ["basic", "standard", "premium"]).notNull(),
  payment_link: varchar("payment_link", { length: 512 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  paid_at: timestamp("paid_at"),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * API usage tracking for cost monitoring
 */
export const apiCalls = mysqlTable("api_calls", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId"), // Optional: link to specific lead if applicable
  service: varchar("service", { length: 64 }).notNull(), // 'llm', 'screenshot', 'storage', etc.
  operation: varchar("operation", { length: 128 }).notNull(), // 'audit_generation', 'screenshot_capture', etc.
  tokensUsed: int("tokensUsed"), // For LLM calls
  estimatedCost: int("estimatedCost").notNull(), // Cost in cents (e.g., 50 = $0.50)
  requestData: text("requestData"), // JSON metadata about the request
  responseStatus: varchar("responseStatus", { length: 32 }).notNull(), // 'success', 'error', 'timeout'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiCall = typeof apiCalls.$inferSelect;
export type InsertApiCall = typeof apiCalls.$inferInsert;

/**
 * User onboarding progress tracking
 */
export const userOnboarding = mysqlTable("user_onboarding", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  hasCompletedScraper: boolean("hasCompletedScraper").default(false).notNull(),
  hasReviewedAudit: boolean("hasReviewedAudit").default(false).notNull(),
  hasSentInvoice: boolean("hasSentInvoice").default(false).notNull(),
  hasReceivedPayment: boolean("hasReceivedPayment").default(false).notNull(),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = typeof userOnboarding.$inferInsert;

/**
 * AI Provider Management - Multi-provider fallback system
 */
export const aiProviders = mysqlTable("ai_providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(), // 'manus', 'openai', 'anthropic', 'google'
  displayName: varchar("displayName", { length: 100 }).notNull(),
  apiKey: text("apiKey"), // Encrypted, NULL for Manus (uses built-in)
  isEnabled: boolean("isEnabled").default(true).notNull(),
  priority: int("priority").default(0).notNull(), // Lower = higher priority
  maxRequestsPerMinute: int("maxRequestsPerMinute"),
  maxTokensPerDay: int("maxTokensPerDay"),
  costPer1kTokens: int("costPer1kTokens"), // Cost in cents (e.g., 500 = $0.005 per 1k tokens)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIProvider = typeof aiProviders.$inferSelect;
export type InsertAIProvider = typeof aiProviders.$inferInsert;

/**
 * API usage logs for cost monitoring and analytics
 */
export const apiUsageLogs = mysqlTable("api_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull(),
  userId: int("userId"), // Optional: track per-user usage
  leadId: int("leadId"), // Optional: link to specific lead
  operation: varchar("operation", { length: 100 }).notNull(), // 'visual_audit', 'email_generation', 'asset_generation'
  model: varchar("model", { length: 100 }), // 'gpt-4o', 'claude-3-5-sonnet', etc.
  promptTokens: int("promptTokens").notNull(),
  completionTokens: int("completionTokens").notNull(),
  totalTokens: int("totalTokens").notNull(),
  cost: int("cost"), // Cost in cents (e.g., 50 = $0.50)
  latencyMs: int("latencyMs"), // Response time in milliseconds
  success: boolean("success").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type APIUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertAPIUsageLog = typeof apiUsageLogs.$inferInsert;

/**
 * Provider health tracking for automatic failover
 */
export const providerHealth = mysqlTable("provider_health", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull().unique(),
  status: mysqlEnum("status", ["healthy", "degraded", "down"]).default("healthy").notNull(),
  lastSuccessAt: timestamp("lastSuccessAt"),
  lastFailureAt: timestamp("lastFailureAt"),
  consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
  avgLatencyMs: int("avgLatencyMs"),
  successRate: int("successRate"), // Percentage * 100 (e.g., 9500 = 95.00%)
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProviderHealth = typeof providerHealth.$inferSelect;
export type InsertProviderHealth = typeof providerHealth.$inferInsert;

/**
 * API Keys for external access (REST API)
 * Allows external apps and AI agents to control the pipeline programmatically.
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Owner of this key
  name: varchar("name", { length: 100 }).notNull(), // Human-readable label (e.g., "n8n automation")
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(), // SHA-256 hash of the raw key
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // First 8 chars for display (e.g., "va_live_ab")
  scopes: text("scopes").notNull(), // JSON array: ["leads:read","leads:write","scrape","audit","pipeline"]
  isActive: boolean("isActive").default(true).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"), // NULL = never expires
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
