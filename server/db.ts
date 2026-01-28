import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, waitlist, InsertWaitlist, leads, InsertLead, audits, InsertAudit, Lead, Audit } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Waitlist functions
export async function addToWaitlist(email: string, targetNiche?: string): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot add to waitlist: database not available");
    return { success: false, message: "Database unavailable" };
  }

  try {
    const values: InsertWaitlist = {
      email,
      targetNiche: targetNiche ?? null,
    };

    await db.insert(waitlist).values(values);
    return { success: true, message: "Successfully added to waitlist" };
  } catch (error: any) {
    // Check for duplicate entry error (MySQL error code)
    if (error?.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY' || error?.message?.includes('Duplicate')) {
      return { success: true, message: "Email already registered" };
    }
    console.error("[Database] Failed to add to waitlist:", error);
    return { success: false, message: "Failed to add to waitlist" };
  }
}

export async function getWaitlistEntries() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get waitlist: database not available");
    return [];
  }

  return await db.select().from(waitlist);
}

// Lead functions for The Curator
export async function createLead(lead: InsertLead): Promise<Lead | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create lead: database not available");
    return null;
  }

  try {
    const result = await db.insert(leads).values(lead);
    const insertId = Number(result[0].insertId);
    
    // Fetch the created lead
    const created = await db.select().from(leads).where(eq(leads.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create lead:", error);
    return null;
  }
}

export async function getLeadsByUserId(userId: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get leads: database not available");
    return [];
  }

  // Return ALL audited leads regardless of userId (single-user system)
  // Show leads with any prestige score to see what's in the system
  const { desc } = await import("drizzle-orm");
  return await db
    .select()
    .from(leads)
    .where(eq(leads.status, "audited"))
    .orderBy(desc(leads.prestigeScore));
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get leads: database not available");
    return [];
  }

  // Return ALL leads regardless of status or userId (for orchestrator/admin views)
  const { desc } = await import("drizzle-orm");
  return await db
    .select()
    .from(leads)
    .orderBy(desc(leads.createdAt));
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get lead: database not available");
    return null;
  }

  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0] || null;
}

export async function updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update lead: database not available");
    return null;
  }

  try {
    await db.update(leads).set(updates).where(eq(leads.id, id));
    return await getLeadById(id);
  } catch (error) {
    console.error("[Database] Failed to update lead:", error);
    return null;
  }
}

// Audit functions
export async function createAudit(audit: InsertAudit): Promise<Audit | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create audit: database not available");
    return null;
  }

  try {
    const result = await db.insert(audits).values(audit);
    const insertId = Number(result[0].insertId);
    
    const created = await db.select().from(audits).where(eq(audits.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create audit:", error);
    return null;
  }
}

export async function getAuditByLeadId(leadId: number): Promise<Audit | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get audit: database not available");
    return null;
  }

  const result = await db.select().from(audits).where(eq(audits.leadId, leadId)).limit(1);
  return result[0] || null;
}

export async function updateLeadAssetsStatus(
  id: number, 
  status: 'not_requested' | 'generating' | 'ready' | 'failed',
  generatedAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update assets status: database not available");
    return;
  }

  try {
    const updates: any = { assetsStatus: status };
    if (generatedAt) {
      updates.assetsGeneratedAt = generatedAt;
    }
    if (status === 'ready') {
      updates.hasAssets = true;
    }
    await db.update(leads).set(updates).where(eq(leads.id, id));
  } catch (error) {
    console.error("[Database] Failed to update assets status:", error);
    throw error;
  }
}

export async function deleteLead(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete lead: database not available");
    return false;
  }

  try {
    // Delete related audits first (foreign key constraint)
    await db.delete(audits).where(eq(audits.leadId, id));
    
    // Delete the lead
    await db.delete(leads).where(eq(leads.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete lead:", error);
    return false;
  }
}
