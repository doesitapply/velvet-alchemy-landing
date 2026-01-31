
import 'dotenv/config';
import { exec } from "child_process";
import { promisify } from "util";
import { createLead, createAudit, updateLead, clearMockStore } from './server/db';
import { analyzeVisualDebt } from './server/visualAudit';
import { generateOutreachCopy } from './server/charmer';
import { makeRequest, PlacesSearchResult, PlaceDetailsResult } from './server/_core/map';
import { sendEmailViaGmail } from './server/lib/emailOutreach';
import { generateAssetsForLead, getAssetsByLeadId } from './server/visionary';
import { findContactEmail } from './server/lib/enrichment';
import fs from "fs";
import path from "path";
import axios from "axios";
import { nanoid } from "nanoid";

const execAsync = promisify(exec);

// Helper to slugify company name
function slugify(text: string) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function runFullAlchemyCycle() {
    await clearMockStore();

    console.log("\n🚀 VELVET ALCHEMY: THE REVENUE ARCHITECT CYCLE");
    console.log("==================================================");

    try {
        // 1. LEAD HUNTING - High Value Niche
        const searchTerm = "Personal Injury Lawyers in Reno, NV";
        console.log(`\n🔍 PHASE 1: TARGETING HIGH-VALUE LEADS ("${searchTerm}")...`);

        const searchPlaces = await makeRequest<PlacesSearchResult>(
            "/maps/api/place/textsearch/json",
            { query: searchTerm }
        );

        if (!searchPlaces.results || searchPlaces.results.length === 0) {
            throw new Error("No leads found in Google Maps.");
        }

        let targetPlace = null;
        let targetWebsite = "";

        // Look for the first lead with a website
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
            targetWebsite = "https://www.thehubreno.com/";
            targetPlace = { name: "Hub Coffee Roasters" };
            console.log(`🎯 FALLBACK TARGET: ${targetPlace.name} (${targetWebsite})`);
        }

        const companySlug = slugify(targetPlace.name!);
        const businessDir = path.join(process.cwd(), "leads_archive", companySlug);
        if (!fs.existsSync(businessDir)) {
            fs.mkdirSync(businessDir, { recursive: true });
        }
        console.log(`📂 ARCHIVE FOLDER: ${businessDir}`);

        // 2. CONTACT ENRICHMENT
        console.log("\n🕵️ PHASE 2: SEARCHING FOR CONTACT INFORMATION...");
        const contactEmail = await findContactEmail(targetWebsite);
        if (contactEmail) {
            console.log(`✅ DISCOVERED EMAIL: ${contactEmail}`);
        } else {
            console.log(`⚠️  No email found directly. Falling back to business defaults.`);
        }

        // 3. LEAD CREATION
        console.log("\n📝 PHASE 3: INITIALIZING LEAD RECORD...");
        const lead = await createLead({
            userId: 1,
            companyName: targetPlace.name!,
            websiteUrl: targetWebsite,
            contactEmail: contactEmail || undefined,
            status: 'pending'
        });

        if (!lead) throw new Error("Failed to create lead in database.");
        console.log(`✅ LEAD ID: ${lead.id}`);

        // 4. TECHNOGRAPHIC SCAN (hunter.py)
        console.log("\n🛰️ PHASE 4: RUNNING TECHNOGRAPHIC SCAN (hunter.py)...");
        let techData = { signals: {}, pain_points: {} };
        try {
            const { stdout: hunterOutput } = await execAsync(`python3 hunter.py --json "${targetWebsite}"`);
            const techResults = JSON.parse(hunterOutput);
            techData = techResults[0] || techData;

            // Save tech data to folder
            fs.writeFileSync(path.join(businessDir, "technographic.json"), JSON.stringify(techResults, null, 2));

            console.log("   Detected Signals:", Object.entries(techData.signals).filter(([_, v]) => v).map(([k]) => k).join(", ") || "None");
            console.log("   Pain Points:", Object.entries(techData.pain_points).filter(([_, v]) => v).map(([k]) => k).join(", ") || "None");
        } catch (e) {
            console.log("   ⚠️  Technographic scan skipped or failed. Continuing...");
        }

        // 5. VISUAL AUDIT & ANALYSIS
        console.log("\n👁️ PHASE 5: PERFORMING VISUAL DEBT AUDIT (GPT-4o Vision)...");
        const demoScreenshot = "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2000&auto=format&fit=crop";

        const auditResult = await analyzeVisualDebt(
            demoScreenshot,
            targetWebsite,
            targetPlace.name!
        );

        console.log(`✅ AUDIT COMPLETE | SCORE: ${auditResult.prestigeScore}/100`);

        // Save Audit to folder
        fs.writeFileSync(path.join(businessDir, "audit_report.json"), JSON.stringify(auditResult, null, 2));

        const savedAudit = await createAudit({
            leadId: lead.id,
            summary: auditResult.summary,
            prestigeScore: auditResult.prestigeScore,
            visualDebtData: JSON.stringify(auditResult)
        });

        // 🛰️ PHASE 6: GENERATING REVENUE LEAK DIAGNOSTICS...
        // [MOD: 2026-01-31] Deactivating asset generation to focus on lightweight, high-ROI technographic audits.
        /*
        console.log("\n🎨 PHASE 6: GENERATING VISUAL ASSETS (Visionary)...");
        const assetResult = await generateAssetsForLead(
            lead.id,
            targetPlace.name!,
            targetWebsite,
            auditResult
        );
        */
        const assetResult = { success: false, assetCount: 0, error: undefined as string | undefined };

        const emailAttachments: any[] = [];

        if (assetResult.success) {
            console.log(`✅ ASSETS READY: Generated ${assetResult.assetCount} custom mockups.`);
            const leadAssets = await getAssetsByLeadId(lead.id);

            // Download assets to local folder and prepare attachments
            const assetsDir = path.join(businessDir, "assets");
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

            for (let i = 0; i < leadAssets.length; i++) {
                const asset = leadAssets[i];
                try {
                    let assetBuffer: Buffer;
                    const isSimulated = asset.url && asset.url.includes('velvet-alchemy.com/simulated');

                    if (isSimulated && asset.s3Key) {
                        const localSimPath = path.join(process.cwd(), "simulated_storage", asset.s3Key);
                        if (fs.existsSync(localSimPath)) {
                            console.log(`      📁 Found simulated asset on disk: ${asset.s3Key}`);
                            assetBuffer = fs.readFileSync(localSimPath);
                        } else {
                            console.warn(`      ⚠️  Simulated asset not found on disk: ${localSimPath}`);
                            assetBuffer = Buffer.from("Simulated Image Content for " + asset.type);
                        }
                    } else if (asset.url && asset.url.startsWith('http')) {
                        console.log(`      🌐 Downloading asset: ${asset.url}`);
                        const assetResponse = await axios.get(asset.url, { responseType: 'arraybuffer' });
                        assetBuffer = Buffer.from(assetResponse.data);
                    } else {
                        console.warn(`      ⚠️  Asset has no valid URL or s3Key: ${asset.type}`);
                        continue;
                    }

                    const fileName = `${asset.type}-${nanoid(5)}.png`;
                    const localPath = path.join(assetsDir, fileName);
                    fs.writeFileSync(localPath, assetBuffer);

                    emailAttachments.push({
                        filename: fileName,
                        content: assetBuffer,
                        contentType: 'image/png',
                        contentId: `asset${i}`
                    });
                } catch (e: any) {
                    console.warn(`      ⚠️  Failed to process asset ${asset.type} for attachment: ${e.message}`);
                }
            }
        } else {
            console.log(`⚠️  Asset generation skipped: ${assetResult.error}`);
        }

        const leadAssets = await getAssetsByLeadId(lead.id);

        // 7. COPY GENERATION (The Charmer)
        console.log("\n✍️ PHASE 7: DRAFTING PERSONALIZED OUTREACH COPY...");
        const outreach = await generateOutreachCopy(lead, savedAudit, leadAssets, techData, demoScreenshot);

        // TEST OVERRIDE as requested by USER
        const testRecipient = "isthisaracket@gmail.com";
        console.log(`\n🧪 TEST MODE: Overriding recipient ${outreach.recipientEmail} -> ${testRecipient}`);
        outreach.recipientEmail = testRecipient;

        // Save email draft to folder
        fs.writeFileSync(path.join(businessDir, "outreach_draft.html"), outreach.htmlBody);
        fs.writeFileSync(path.join(businessDir, "outreach_draft.txt"), outreach.body);

        console.log(`\n--- [DRAFT] ---`);
        console.log(`Subject: ${outreach.subject}`);
        console.log(`Recipient: ${outreach.recipientEmail}`);
        console.log(`\n${outreach.body}`);
        console.log(`---------------\n`);

        // 8. OUTREACH DELIVERY (Actually Send!)
        console.log("📤 PHASE 8: DELIVERING COLD EMAIL VIA GMAIL API...");

        let sendResult;
        try {
            sendResult = await sendEmailViaGmail({
                to: outreach.recipientEmail,
                subject: outreach.subject,
                body: outreach.body,
                htmlBody: outreach.htmlBody,
                attachments: emailAttachments
            });
        } catch (err: any) {
            sendResult = { success: false, error: err.message };
        }

        if (sendResult.success) {
            console.log(`✅ MISSION ACCOMPLISHED! Email sent successfully.`);
            console.log(`   Message ID: ${sendResult.messageId}`);
        } else if (sendResult.error?.includes('credentials missing')) {
            console.log(`⚠️  SIMULATED SEND: Gmail API credentials missing in .env.`);
            console.log(`   READY FOR INBOX: [${outreach.recipientEmail}]`);
            console.log(`   (Configure GOOGLE_REFRESH_TOKEN to enable real sending.)`);
        } else {
            console.error(`❌ SEND FAILED: ${sendResult.error}`);
        }

        await updateLead(lead.id, {
            status: 'contacted',
            prestigeScore: auditResult.prestigeScore
        });

        console.log("\n✨ FULL CYCLE COMPLETE. REVENUE INSTRUMENT ENGAGED.");

    } catch (error) {
        console.error("\n💥 CYCLE INTERRUPTED:", error);
    }
}

runFullAlchemyCycle();
