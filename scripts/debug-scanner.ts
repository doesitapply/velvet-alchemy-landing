
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });
dotenv.config(); // Load .env as fallback

import { createLead, createAudit, updateLead } from "../server/db";
import { captureScreenshot } from "../server/screenshot";
import { storagePut } from "../server/storage";
import { analyzeVisualDebt } from "../server/visualAudit";
import { nanoid } from "nanoid";

async function runDebug() {
    console.log("1. Starting Debug Scan...");
    const input = {
        companyName: "Debug LLC",
        websiteUrl: "https://example.com"
    };

    console.log("2. Capturing Screenshot...");
    const screenshot = await captureScreenshot(input.websiteUrl);
    console.log("   Screenshot success:", screenshot.success);

    let screenshotUrl = "";
    let fileKey = "";

    if (screenshot.success) {
        console.log("3. Uploading to Storage...");
        fileKey = `leads/debug/${nanoid()}.png`;
        const uploadResult = await storagePut(fileKey, screenshot.buffer, 'image/png');
        screenshotUrl = uploadResult.url;
        console.log("   Storage URL:", screenshotUrl);
    } else {
        console.log("   Skipping storage (screenshot failed).");
        screenshotUrl = "https://placehold.co/600x400";
    }

    console.log("4. Creating Lead in DB...");
    try {
        const lead = await createLead({
            userId: 1,
            companyName: input.companyName,
            websiteUrl: input.websiteUrl,
            screenshotUrl: screenshotUrl,
            screenshotKey: fileKey,
            status: 'pending',
        });
        console.log("   Lead created with ID:", lead.id);

        console.log("5. Running AI Analysis...");
        const auditResult = await analyzeVisualDebt(
            screenshotUrl,
            input.websiteUrl,
            input.companyName
        );
        console.log("   AI Score:", auditResult.prestigeScore);

        console.log("6. Creating Audit Record...");
        const audit = await createAudit({
            leadId: lead.id,
            summary: auditResult.summary,
            prestigeScore: auditResult.prestigeScore,
            visualDebtData: JSON.stringify(auditResult),
        });
        console.log("   Audit created with ID:", audit.id);

        console.log("7. Updating Lead Status...");
        await updateLead(lead.id, {
            prestigeScore: auditResult.prestigeScore,
            status: 'audited',
        });
        console.log("   Lead updated.");

        console.log("✅ DEBUG SCAN COMPLETE SUCCESS");

    } catch (err: any) {
        console.error("❌ CRTICAL FAILURE:", err);
        console.error("Stack:", err.stack);
    }
}

runDebug().catch(console.error);
