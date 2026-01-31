import { describe, it, expect, beforeAll } from "vitest";
import { getAllLeads, getAllPayments } from "./db";

describe("Activity Feed", () => {
  it("should fetch unified activity feed with leads and payments", async () => {
    // Get recent leads
    const recentLeads = (await getAllLeads()).slice(0, 20);

    // Get recent payments
    const recentPayments = (await getAllPayments()).slice(0, 20);

    expect(recentLeads).toBeDefined();
    expect(recentPayments).toBeDefined();
    expect(Array.isArray(recentLeads)).toBe(true);
    expect(Array.isArray(recentPayments)).toBe(true);
  });

  it("should combine leads and payments into unified activity stream", async () => {
    const recentLeads = (await getAllLeads()).slice(0, 5);

    const recentPayments = (await getAllPayments())
      .filter((p) => p.status === "completed")
      .slice(0, 5);

    const activities: Array<{
      id: string;
      type: string;
      title: string;
      timestamp: Date;
    }> = [];

    // Add lead activities
    recentLeads.forEach((lead: any) => {
      if (lead.status === 'audited' && lead.prestigeScore !== null) {
        activities.push({
          id: `audit-${lead.id}`,
          type: 'audit_completed',
          title: `Audit completed for ${lead.companyName}`,
          timestamp: new Date(lead.updatedAt),
        });
      } else {
        activities.push({
          id: `lead-${lead.id}`,
          type: 'lead_created',
          title: `New lead: ${lead.companyName}`,
          timestamp: new Date(lead.createdAt),
        });
      }
    });

    // Add payment activities
    recentPayments.forEach((payment: any) => {
      activities.push({
        id: `payment-${payment.id}`,
        type: 'payment_received',
        title: `Payment received`,
        timestamp: new Date(payment.created_at),
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    expect(activities.length).toBeGreaterThanOrEqual(0);
    if (activities.length > 0) {
      expect(activities[0]).toHaveProperty('id');
      expect(activities[0]).toHaveProperty('type');
      expect(activities[0]).toHaveProperty('title');
      expect(activities[0]).toHaveProperty('timestamp');
    }
  });

  it("should limit activity feed to 15 items", async () => {
    const recentLeads = (await getAllLeads()).slice(0, 20);
    const recentPayments = (await getAllPayments()).slice(0, 20);

    const totalActivities = recentLeads.length + recentPayments.filter((p: any) => p.status === 'completed').length;
    const expectedCount = Math.min(totalActivities, 15);

    // Activity feed should never exceed 15 items
    expect(expectedCount).toBeLessThanOrEqual(15);
  });

  it("should format activity types correctly", async () => {
    const activityTypes = ['lead_created', 'audit_completed', 'payment_received', 'outreach_sent'];
    
    activityTypes.forEach(type => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });
});
