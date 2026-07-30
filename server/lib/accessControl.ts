import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { leads, type Lead } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";

export type AccessUser = {
  id: number;
  role?: string | null;
  openId?: string | null;
};

export function isPrivilegedUser(user: AccessUser): boolean {
  return (
    user.role === "admin" ||
    Boolean(ENV.ownerOpenId && user.openId === ENV.ownerOpenId)
  );
}

export function requirePrivilegedUser(user: AccessUser): void {
  if (!isPrivilegedUser(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
}

export function requireCostAuthority(user: AccessUser): void {
  if (!isPrivilegedUser(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Administrator approval is required for actions that can use paid or metered services.",
    });
  }
}

export async function requireOwnedLead(
  leadId: number,
  user: AccessUser
): Promise<Lead> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Database unavailable.",
    });
  }

  const ownership = isPrivilegedUser(user)
    ? eq(leads.id, leadId)
    : and(eq(leads.id, leadId), eq(leads.userId, user.id));
  const [lead] = await db.select().from(leads).where(ownership).limit(1);

  if (!lead) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Lead not found.",
    });
  }
  return lead;
}
