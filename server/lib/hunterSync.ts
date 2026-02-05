import * as db from "../db";
import { supabase } from "../_core/supabase";
import { TRPCError } from "@trpc/server";

export async function syncHunterLeads(userId: number) {
    try {
        console.log("[Sync] Starting sync from Supabase...");

        // 1. Fetch leads from Supabase "technographic_leads"
        const { data: hunterLeads, error } = await supabase
            .from('technographic_leads')
            .select('*')
            .order('last_scanned_at', { ascending: false })
            .limit(50); // Increased limit for robust sync

        if (error) {
            console.error("Supabase error:", error);
            throw new Error(`Failed to fetch from Supabase: ${error.message}`);
        }

        if (!hunterLeads || hunterLeads.length === 0) {
            console.log("[Sync] No leads found in Supabase.");
            return { success: true, count: 0, message: "No leads found in Supabase" };
        }

        console.log(`[Sync] Found ${hunterLeads.length} leads in Supabase. Importing...`);

        const results = { created: 0, skipped: 0, errors: 0 };

        // 2. Import into local DB
        for (const hLead of hunterLeads) {
            try {
                const url = hLead.url;
                // Heuristic name generation
                let name = hLead.company_domain
                    ? hLead.company_domain.split('.')[0]
                    : new URL(url).hostname.replace('www.', '').split('.')[0];

                // Capitalize first letter
                name = name.charAt(0).toUpperCase() + name.slice(1);

                // Check if lead already exists to avoid duplicates
                // We can't easily check duplication without raw SQL or a specific select helper
                // So we'll just insert and rely on unique constraints if they exist, or just insert.
                // For MVP, simple insert is fine, user can dedup.

                await db.createLead({
                    userId: userId,
                    companyName: name,
                    websiteUrl: url,
                    status: 'pending',
                    priorityScore: hLead.has_pixel ? 80 : 40, // Bonus for having pixel (spending money)
                    prestigeScore: hLead.ssl_error ? 10 : null, // Penalty for SSL error
                });
                results.created++;
            } catch (err) {
                // console.error("Failed to import lead", err);
                results.errors++;
            }
        }

        return { success: true, count: results.created, results };

    } catch (error: any) {
        console.error("Sync error:", error);
        throw new Error(`Sync failed: ${error.message}`);
    }
}
