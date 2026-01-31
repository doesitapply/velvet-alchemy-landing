import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, waitlist, InsertWaitlist, leads, InsertLead, audits, InsertAudit, Lead, Audit, assets, InsertAsset, type InsertAuditLog } from "../drizzle/schema";
import { ENV } from './_core/env';

// ----------------------------------------------------------------------------
// IN-MEMORY STORE (Replaces Database for Local Dev)
// ----------------------------------------------------------------------------
// This ensures the app fully "works" - creating leads, saving audits, generating assets -
// without needing an external MySQL connection. Data persists during the session.

export interface PaymentRecord {
  id: number;
  lead_id: number;
  stripe_checkout_session_id: string;
  amount: number;
  currency: string;
  status: string;
  package_type: string;
  payment_link?: string;
  stripe_payment_intent_id?: string | null;
  paid_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RateLimitRecord {
  id: number;
  userId: number;
  action: string;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SystemConfigRecord {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLogRecord {
  id: number;
  userId?: number | null;
  action: string;
  resource?: string | null;
  resourceId?: number | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: "success" | "failure" | "blocked";
  createdAt: Date;
}

interface MemoryStore {
  users: any[];
  leads: any[];
  audits: any[];
  assets: any[];
  waitlist: any[];
  payments: PaymentRecord[];
  rateLimits: RateLimitRecord[];
  systemConfig: SystemConfigRecord[];
  auditLogs: AuditLogRecord[];
}

const store: MemoryStore = {
  users: [
    { id: 1, openId: ENV.ownerOpenId || "admin", name: "Architect Cameron", role: "admin", createdAt: new Date() }
  ],
  leads: [
    {
      id: 1,
      userId: 1,
      companyName: "Silver and Blue Outfitters",
      websiteUrl: "https://silverandblueoutfitters.com",
      status: "audited",
      prestigeScore: 90,
      screenshotUrl: "https://silverandblueoutfitters.com/cdn/shop/files/SBO_Logo_2024_Main_400x.png?v=1706649568",
      screenshotKey: "mock-key-1",
      hasAssets: true,
      hasOutreach: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      summary: "High potential lead. Shopify store with missing analytics. $5k opportunity."
    },
    {
      id: 2,
      userId: 1,
      companyName: "Reno Running Company",
      websiteUrl: "https://renorunningcompany.com",
      status: "outreach_sent",
      prestigeScore: 65,
      screenshotUrl: "https://dummyimage.com/600x400/000/fff&text=Reno+Running",
      screenshotKey: "mock-key-2",
      hasAssets: true,
      hasOutreach: true,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 3600000),
      summary: "Existing analytics found. Lower priority."
    },
    {
      id: 3,
      userId: 1,
      companyName: "Flowing Tide Pub",
      websiteUrl: "https://flowingtidepub.com",
      status: "pending",
      prestigeScore: null,
      screenshotUrl: "https://dummyimage.com/600x400/000/fff&text=Flowing+Tide",
      screenshotKey: "mock-key-3",
      hasAssets: false,
      hasOutreach: false,
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(Date.now() - 172800000),
      summary: "Pending audit."
    }
  ],
  audits: [],
  assets: [],
  waitlist: [],
  payments: [],
  rateLimits: [],
  systemConfig: [
    {
      id: 1,
      key: "global_kill_switch",
      value: "false",
      description: "Global system kill-switch",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      key: "rate_limit_enabled",
      value: "true",
      description: "Enable rate limiting",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      key: "domain_check_enabled",
      value: "true",
      description: "Enable domain reputation checks",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  auditLogs: [],
};

function nextId<T extends { id: number }>(collection: T[]): number {
  if (collection.length === 0) return 1;
  return Math.max(...collection.map(item => item.id)) + 1;
}

// Returns a "fake" db object if needed for compatibility, 
// but mostly we will bypass it in our helper functions.
let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  // Always return the mock DB interface to ensure routers proceed
  return dbMock as any;
}

// Helper to check if we should use mock data
// We return false now because we WANT the routers to think there is a DB so they call our functions
export const isMockMode = () => false;


// ----------------------------------------------------------------------------
// DATABASE FUNCTIONS (Redirected to Memory Store)
// ----------------------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<void> {
  const existingIndex = store.users.findIndex(u => u.openId === user.openId);
  const now = new Date();

  const userData = {
    ...user,
    lastSignedIn: now,
    updatedAt: now,
    role: user.role || 'user'
  };

  // Check if we can "claim" the admin account (ID 1)
  // Logic: If ID 1 is still the default placeholder ("admin" or ownerOpenId) AND we are a real user
  const adminUser = store.users.find(u => u.id === 1);
  const defaultOpenId = ENV.ownerOpenId || "admin";

  // If the admin user is still the default placeholder
  if (adminUser && adminUser.openId === defaultOpenId && user.openId !== defaultOpenId) {
    console.log(`[MemoryStore] 👑 Claiming Admin Account (ID 1) for user: ${user.email || user.name}`);

    store.users[0] = {
      ...store.users[0],
      ...userData,
      openId: user.openId, // Update openId to the real one
      role: "admin",       // Ensure they stay admin
      lastSignedIn: now,
      updatedAt: now
    };
    return;
  }

  if (existingIndex >= 0) {
    store.users[existingIndex] = { ...store.users[existingIndex], ...userData };
  } else {
    store.users.push({
      ...userData,
      id: store.users.length + 1,
      createdAt: now
    });
  }
}

export async function getUserByOpenId(openId: string) {
  return store.users.find(u => u.openId === openId);
}

// Waitlist
export async function addToWaitlist(email: string, targetNiche?: string): Promise<{ success: boolean; message: string }> {
  if (store.waitlist.find(w => w.email === email)) {
    return { success: true, message: "Email already registered" };
  }
  store.waitlist.push({
    id: store.waitlist.length + 1,
    email,
    targetNiche,
    status: 'pending',
    createdAt: new Date()
  });
  return { success: true, message: "Successfully added to waitlist" };
}

export async function getWaitlistEntries() {
  return store.waitlist;
}

// Leads
export async function createLead(lead: InsertLead): Promise<Lead | null> {
  const newLead = {
    ...lead,
    id: store.leads.length + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    prestigeScore: lead.prestigeScore || null,
    status: lead.status || 'pending',
    hasAssets: false,
    hasOutreach: false
  };
  store.leads.push(newLead);
  console.log(`[MemoryStore] Created lead: ${newLead.companyName} (ID: ${newLead.id})`);
  return newLead as any;
}

export async function getLeadsByUserId(userId: number): Promise<Lead[]> {
  return store.leads.sort((a, b) => (b.prestigeScore || 0) - (a.prestigeScore || 0)) as any;
}

export async function getAllLeads(): Promise<Lead[]> {
  return store.leads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) as any;
}

export async function getLeadById(id: number): Promise<Lead | null> {
  return (store.leads.find(l => l.id === id) || null) as any;
}

export async function updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead | null> {
  const index = store.leads.findIndex(l => l.id === id);
  if (index === -1) return null;

  store.leads[index] = {
    ...store.leads[index],
    ...updates,
    updatedAt: new Date()
  };
  return store.leads[index] as any;
}

export async function deleteLead(id: number): Promise<boolean> {
  const index = store.leads.findIndex(l => l.id === id);
  if (index === -1) return false;

  store.leads.splice(index, 1);
  return true;
}

// Audits
export async function createAudit(audit: InsertAudit): Promise<Audit | null> {
  const newAudit = {
    ...audit,
    id: store.audits.length + 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  store.audits.push(newAudit);
  return newAudit as any;
}

export async function getAuditByLeadId(leadId: number): Promise<Audit | null> {
  return (store.audits.find(a => a.leadId === leadId) || null) as any;
}

// Assets (Needed for Visionary)
export async function updateLeadAssetsStatus(
  id: number,
  status: 'not_requested' | 'generating' | 'ready' | 'failed',
  generatedAt?: Date
): Promise<void> {
  const index = store.leads.findIndex(l => l.id === id);
  if (index === -1) return;

  const updates: any = { assetsStatus: status };
  if (generatedAt) updates.assetsGeneratedAt = generatedAt;
  if (status === 'ready') updates.hasAssets = true;

  store.leads[index] = { ...store.leads[index], ...updates };
}

// Payments -------------------------------------------------------------------
export async function createPaymentRecord(data: Omit<PaymentRecord, "id" | "created_at" | "updated_at">): Promise<PaymentRecord> {
  const now = new Date();
  const payment: PaymentRecord = {
    id: nextId(store.payments),
    created_at: now,
    updated_at: now,
    ...data,
  };
  store.payments.push(payment);
  return payment;
}

export async function getPaymentsByLeadId(leadId: number): Promise<PaymentRecord[]> {
  return store.payments
    .filter(p => p.lead_id === leadId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export async function getPaymentsByUserId(userId: number): Promise<Array<PaymentRecord & { companyName: string; websiteUrl: string }>> {
  const leadMap = new Map(store.leads.filter(l => l.userId === userId).map(l => [l.id, l]));
  return store.payments
    .filter(p => leadMap.has(p.lead_id))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .map(payment => {
      const lead = leadMap.get(payment.lead_id);
      return {
        ...payment,
        companyName: lead?.companyName || "Unknown",
        websiteUrl: lead?.websiteUrl || "",
      };
    });
}

export async function getPaymentBySessionId(sessionId: string): Promise<PaymentRecord | undefined> {
  return store.payments.find(p => p.stripe_checkout_session_id === sessionId);
}

export async function updatePaymentBySessionId(sessionId: string, updates: Partial<PaymentRecord>): Promise<void> {
  const index = store.payments.findIndex(p => p.stripe_checkout_session_id === sessionId);
  if (index === -1) return;
  store.payments[index] = {
    ...store.payments[index],
    ...updates,
    updated_at: new Date(),
  };
}

export async function getAllPayments(): Promise<PaymentRecord[]> {
  return [...store.payments];
}

// Need to expose db insert for assets since Visionary uses it directly
// We'll mock the db.insert().values() chain for `assets` table specifically
// Improved Mock DB that supports chaining and acts like a Promise
const createMockQueryBuilder = (initialCollection: any[]) => {
  let context = { collection: initialCollection };
  const builder: any = {
    from: (table: any) => {
      // Drizzle tables often use symbols or internal symbols for names
      let tableName = (table?.name || table?._?.name || table?.config?.name || "");
      if (!tableName && table?.[Symbol.for('drizzle:Name')]) {
        tableName = table[Symbol.for('drizzle:Name')];
      }

      const tableKey = tableName.toString().toLowerCase();
      console.log(`[dbMock] select.from("${tableKey}")`);

      if (tableKey.includes('asset')) context.collection = store.assets;
      else if (tableKey.includes('audit')) context.collection = store.audits;
      else if (tableKey.includes('lead')) context.collection = store.leads;
      else if (tableKey.includes('user')) context.collection = store.users;
      else if (tableKey.includes('waitlist')) context.collection = store.waitlist;

      return builder;
    },
    where: (condition: any) => {
      let targetId: number | null = null;

      if (condition && typeof condition === 'object') {
        const extractId = (obj: any): any => {
          if (obj === null || obj === undefined) return null;
          if (typeof obj === 'number') return obj;
          if (typeof obj === 'string' && !isNaN(Number(obj))) return Number(obj);

          // Drizzle often nests values in .value, .right, or .right.value
          if (obj.value !== undefined) return extractId(obj.value);
          if (obj.right !== undefined) return extractId(obj.right);
          if (obj.left !== undefined && typeof obj.left === 'number') return obj.left;

          // Check for common Drizzle property names
          for (const key of ['val', 'right', 'value', 'left']) {
            if (obj[key] !== undefined) {
              const res = extractId(obj[key]);
              if (res !== null) return res;
            }
          }
          return null;
        };
        targetId = extractId(condition);
      }

      const condStr = (condition || "").toString();
      if (targetId === null) {
        // Very aggressive regex for digits in strings like "leads.id = 1"
        const match = condStr.match(/(\s|=)(\d+)(\s|$)/);
        if (match) targetId = parseInt(match[2]);
        else if (condStr.match(/^\d+$/)) targetId = parseInt(condStr);
      }

      console.log(`[dbMock] where: id=${targetId} (expr: ${condStr})`);

      if (targetId !== null) {
        context.collection = context.collection.filter((item: any) => {
          const itemLeadId = item.leadId || item.lead_id || (context.collection === store.leads ? item.id : null);
          return itemLeadId !== undefined && itemLeadId !== null && Number(itemLeadId) === Number(targetId);
        });
      } else {
        // If we have a where clause but NO id was found, we might be doing a more complex query (like status = 'active')
        // For the mock, we'll allow it to return everything if it's not a numeric filter, 
        // OR we just log it. Let's return everything for now to avoid breaking other flows,
        // but log clearly.
        console.warn("[dbMock] Warning: Where clause provided but no ID resolved. Returning full collection.");
      }
      return builder;
    },
    limit: () => builder,
    orderBy: () => builder,
    offset: () => builder,
    leftJoin: () => builder,
    then: (resolve: Function) => {
      // Return a copy to prevent external mutation issues
      resolve([...context.collection]);
    }
  };
  return builder;
};

export const dbMock = {
  insert: (table: any) => ({
    values: async (vals: any | any[]) => {
      const items = Array.isArray(vals) ? vals : [vals];
      const tableName = table?.name || table?._?.name;

      items.forEach((item: any) => {
        if (!item.id) item.id = Math.floor(Math.random() * 100000);
        const record = { ...item, createdAt: new Date() };

        if (tableName === 'leads' || item.companyName) {
          store.leads.push({ ...record, hasAssets: false, hasOutreach: false });
        } else if (tableName === 'assets' || (item.leadId && (item.type || item.url || item.s3Key))) {
          store.assets.push(record);
        } else if (tableName === 'audits' || (item.leadId && (item.summary || item.prestigeScore !== undefined))) {
          store.audits.push(record);
        } else if (tableName === 'users' || item.openId) {
          store.users.push(record);
        } else if (tableName === 'waitlist' || item.email) {
          store.waitlist.push(record);
        }
      });
      return [{ insertId: items.length }];
    }
  }),
  select: () => createMockQueryBuilder(store.leads),
  update: (table: any) => ({
    set: (values: any) => ({
      where: (condition: any) => ({
        then: (resolve: Function) => resolve([{ affectedRows: 1 }])
      })
    })
  }),
  delete: (table: any) => ({
    where: () => ({
      then: (resolve: Function) => resolve([{ affectedRows: 1 }])
    })
  })
};

// Hack: Overwrite the getDb to return a mock object that scraperRouter can use
// scraperRouter checks for !db.getDb(), so we need to fix THAT call site too?
// No, scraperRouter imports * as db, so it calls db.getDb(). 
// If we return null, it stops. 
// So let's make getDb return OUR helper object that mimics drizzle partially?
// Actually, scraperRouter uses db.createLead() which is our exported function.
// It ONLY uses db.getDb() for the check: `const dbConn = await db.getDb(); if (!dbConn) continue;`
// So we MUST return something truthy from getDb() for the scraper to proceed!

export async function getDbForScraper() {
  return dbMock as any;
}

// Redefine getDb to return the mock so consumers don't bail out
export async function getDb2() {
  return dbMock as any;
}
// We have to overwrite the original export
// to make sure scraperRouter continues.

// ---------------------------------------------------------------------------
// System Config Helpers
// ---------------------------------------------------------------------------

export async function getSystemConfigEntries(): Promise<SystemConfigRecord[]> {
  return [...store.systemConfig];
}

export async function getSystemConfigValue(key: string): Promise<SystemConfigRecord | undefined> {
  return store.systemConfig.find((entry) => entry.key === key);
}

export async function setSystemConfigValue(key: string, value: string, description?: string): Promise<SystemConfigRecord> {
  const existing = store.systemConfig.find((entry) => entry.key === key);
  const now = new Date();

  if (existing) {
    existing.value = value;
    if (description) existing.description = description;
    existing.updatedAt = now;
    return existing;
  }

  const entry: SystemConfigRecord = {
    id: nextId(store.systemConfig),
    key,
    value,
    description,
    createdAt: now,
    updatedAt: now,
  };
  store.systemConfig.push(entry);
  return entry;
}

export async function deleteSystemConfigKey(key: string): Promise<void> {
  const index = store.systemConfig.findIndex((entry) => entry.key === key);
  if (index !== -1) {
    store.systemConfig.splice(index, 1);
  }
}

// ---------------------------------------------------------------------------
// Rate Limit Helpers
// ---------------------------------------------------------------------------

export async function findActiveRateLimit(userId: number, action: string, now: Date): Promise<RateLimitRecord | undefined> {
  return store.rateLimits.find(
    (record) => record.userId === userId && record.action === action && record.windowEnd >= now
  );
}

export async function createRateLimitRecord(entry: Omit<RateLimitRecord, "id" | "createdAt" | "updatedAt">): Promise<RateLimitRecord> {
  const now = new Date();
  const record: RateLimitRecord = {
    id: nextId(store.rateLimits),
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
  store.rateLimits.push(record);
  return record;
}

export async function incrementRateLimitRecord(recordId: number): Promise<void> {
  const record = store.rateLimits.find((r) => r.id === recordId);
  if (!record) return;
  record.count += 1;
  record.updatedAt = new Date();
}

export async function getRateLimitRecords(): Promise<RateLimitRecord[]> {
  return [...store.rateLimits];
}

// ---------------------------------------------------------------------------
// Audit Log Helpers
// ---------------------------------------------------------------------------

export async function insertAuditLogEntry(entry: InsertAuditLog): Promise<void> {
  const record: AuditLogRecord = {
    id: nextId(store.auditLogs),
    userId: entry.userId || null,
    action: entry.action,
    resource: entry.resource || null,
    resourceId: entry.resourceId || null,
    details: entry.details || null,
    ipAddress: entry.ipAddress || null,
    userAgent: entry.userAgent || null,
    status: entry.status,
    createdAt: entry.createdAt || new Date(),
  };
  store.auditLogs.push(record);
}

export async function getAuditLogEntries(limit = 20): Promise<AuditLogRecord[]> {
  return [...store.auditLogs]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function clearMockStore() {
  console.log("[dbMock] Clearing Memory Store for fresh cycle...");
  store.leads = [];
  store.audits = [];
  store.assets = [];
  store.payments = [];
  store.auditLogs = [];
}
