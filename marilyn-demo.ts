
import 'dotenv/config';
import { exec } from "child_process";
import { promisify } from "util";
import { createLead, createAudit, updateLead, clearMockStore } from './server/db';
import { analyzeVisualDebt } from './server/visualAudit';
import { generateOutreachCopy } from './server/charmer';
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from './server/_core/map';
import { sendEmailViaGmail } from './server/lib/emailOutreach';
import { getAssetsByLeadId } from './server/visionary';
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// Recipient list
const testRecipients = ["isthisaracket@gmail.com", "marilynchurch775@gmail.com"];

async function runDemoCycle(searchTerm: string) {
    console.log(`\n\n\n🚀 STARTING DEMO CYCLE: "${searchTerm}"`);
    console.log("==================================================");

    try {
        // 1. LEAD HUNTING
        const searchPlaces = await makeRequest<PlacesSearchResult>(
            "/maps/api/place/textsearch/json",
            { query: searchTerm }
        );

        if (!searchPlaces.results || searchPlaces.results.length === 0) {
            console.log("   ⚠️ No leads found for this search.");
            return;
        }

        let targetPlace = null;
        let targetWebsite = "";

        for (const place of searchPlaces.results.slice(0, 10)) {
            const details = await makeRequest<PlaceDetailsResult>(
                "/maps/api/place/details/json",
                {
                    place_id: place.place_id,
                    fields: "name,website,formatted_address,formatted_phone_number"
                }
            );

            if (details.result.website) {
                targetPlace = details.result;
                targetWebsite = details.result.website;
                console.log(`🎯 TARGETED: ${targetPlace.name} (${targetWebsite})`);
                break;
            }
        }

        if (!targetPlace || !targetWebsite) {
            console.log("   ⚠️ No leads with websites found.");
            return;
        }

        // 2. LEAD INITIALIZATION
        const lead = await createLead({
            userId: 1,
            companyName: targetPlace.name!,
            websiteUrl: targetWebsite,
            status: 'pending'
        });

        // 3. TECHNOGRAPHIC SCAN
        console.log("\n🛰️  PHASE 4: RUNNING TECHNOGRAPHIC SCAN...");
        let techData = { signals: {}, pain_points: {} };
        try {
            const { stdout: hunterOutput } = await execAsync(`python3 hunter.py --json "${targetWebsite}"`);
            const techResults = JSON.parse(hunterOutput);
            techData = techResults[0] || techData;
        } catch (e) {
            console.log("   ⚠️  Technographic scan skipped.");
        }

        // 4. VISUAL AUDIT
        console.log("\n👁️  PHASE 5: PERFORMING VISUAL DEBT AUDIT...");
        const demoScreenshot = "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2000&auto=format&fit=crop";
        const auditResult = await analyzeVisualDebt(demoScreenshot, targetWebsite, targetPlace.name!);

        const savedAudit = await createAudit({
            leadId: lead.id,
            summary: auditResult.summary,
            prestigeScore: auditResult.prestigeScore,
            visualDebtData: JSON.stringify(auditResult)
        });

        // 5. COPY GENERATION (Internal Use Only Persona)
        console.log("\n✍️  PHASE 7: DRAFTING INTERNAL USE ONLY DISCLOSURE...");
        const outreach = await generateOutreachCopy(lead, savedAudit, [], techData, demoScreenshot);

        // 6. DELIVERY
        console.log("\n📤 PHASE 8: DELIVERING COLD EMAIL...");
        for (const recipient of testRecipients) {
            console.log(`   Sending to ${recipient}...`);
            await sendEmailViaGmail({
                to: recipient,
                subject: outreach.subject,
                body: outreach.body,
                htmlBody: outreach.htmlBody,
                attachments: [] // No assets in this minimal flow
            });
        }

        console.log(`✅ DEMO COMPLETE FOR ${targetPlace.name}`);

    } catch (error: any) {
        console.error(`💥 DEMO FAILED FOR ${searchTerm}:`, error.message);
    }
}

async function runMarilynTour() {
    await clearMockStore();

    const niches = [
        "Personal Injury Lawyers in Reno, NV",
        "Real Estate Agencies in Reno, NV",
        "Fine Dining Restaurants in Reno, NV"
    ];

    for (const niche of niches) {
        await runDemoCycle(niche);
    }

    console.log("\n\n✨ TOUR COMPLETE. MARILYN HAS BEEN BRIEFED.");
}

runMarilynTour();
