
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db, createLead, getLeadById, createAudit, getAuditByLeadId, getAllLeads } from '../server/db';
import { executePipeline, getPipelineJobStatus } from '../server/orchestrator';

async function verifyProductDelivery() {
    console.log("📦 VERIFYING PRODUCT DELIVERY PIPELINE 📦\n");

    // 1. Setup Lead
    const timestamp = Date.now();
    console.log("1. Creating Test Lead...");
    const lead = await createLead({
        userId: 1,
        companyName: `Delivery Test ${timestamp}`,
        websiteUrl: `https://example.com`, // Use a real reachable URL or specific test one
    });
    console.log(`   > Lead ID: ${lead.id}`);

    // 2. Execute Pipeline
    console.log("\n2. Executing Pipeline (Screenshot -> Assets -> Outreach)...");
    // We run executePipeline which is async but returns void, we need to poll or wait.
    // Actually executePipeline waits for completion of steps in the current implementation? 
    // Looking at orchestrator.ts source: yes, it awaits runScreenshotAndAuditStage etc.
    await executePipeline(lead.id, 1);

    // 3. Verify Results
    console.log("\n3. Verifying Results...");

    // Check Lead Status & Screenshot
    const updatedLead = await getLeadById(lead.id);
    console.log(`   > Lead Status: ${updatedLead?.status}`);
    console.log(`   > Screenshot URL: ${updatedLead?.screenshotUrl}`);

    if (updatedLead?.screenshotUrl && updatedLead.screenshotUrl.includes('localhost')) {
        console.log("   ✅ Screenshot URL is local and valid format.");
    } else {
        console.error("   ❌ Screenshot URL invalid or missing.");
    }

    // Verify File Exists on Disk
    if (updatedLead?.screenshotKey) {
        // Storage simulation path (hardcoded in storage.ts as process.cwd()/simulated_storage)
        const filePath = path.join(process.cwd(), 'simulated_storage', updatedLead.screenshotKey);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ File exists on disk: ${filePath}`);
        } else {
            console.error(`   ❌ File NOT found on disk: ${filePath}`);
        }
    }

    // Check Audit
    const audit = await getAuditByLeadId(lead.id);
    if (audit) {
        console.log(`   ✅ Audit generated. Prestige: ${audit.prestigeScore}`);
    } else {
        console.error("   ❌ Audit missing.");
    }

    if (updatedLead?.hasOutreach) {
        console.log("   ✅ Outreach Draft generated.");
    } else {
        console.error("   ❌ Outreach Draft missing.");
    }

    console.log("\n---------------------------------------------------");
    if (updatedLead?.screenshotUrl && audit && updatedLead?.hasOutreach) {
        console.log("🎉 PIPELINE DELIVERY SUCCESSFUL");
        process.exit(0);
    } else {
        console.error("🔥 PIPELINE DELIVERY FAILED");
        process.exit(1);
    }
}

verifyProductDelivery().catch(console.error);
