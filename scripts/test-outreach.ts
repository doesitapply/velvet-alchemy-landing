/**
 * Test outreach email generation
 * Run with: npx tsx scripts/test-outreach.ts <leadId>
 */

import { generateEmailInVoice } from "../server/voiceAnalyzer";
import { getDb } from "../server/db";
import { voiceProfiles, leads, audits } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const leadId = parseInt(process.argv[2] || "360019");
  
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Get voice profile
  const profiles = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, 1)).limit(1);
  if (profiles.length === 0) {
    console.error("No voice profile found. Run init-voice-profile.ts first.");
    process.exit(1);
  }
  const profile = profiles[0];

  // Get lead and audit
  const leadData = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (leadData.length === 0) {
    console.error(`Lead ${leadId} not found`);
    process.exit(1);
  }
  const lead = leadData[0];

  const auditData = await db.select().from(audits).where(eq(audits.leadId, leadId)).limit(1);
  if (auditData.length === 0) {
    console.error(`No audit found for lead ${leadId}`);
    process.exit(1);
  }
  const audit = auditData[0];

  console.log(`\n📧 Generating outreach email for: ${lead.companyName}`);
  console.log(`   Website: ${lead.websiteUrl}`);
  console.log(`   Prestige Score: ${audit.prestigeScore}/100`);
  console.log(`\n   Using voice profile:`);
  console.log(`   - Formality: ${profile.formality}`);
  console.log(`   - Directness: ${profile.directness}`);
  console.log(`   - Enthusiasm: ${profile.enthusiasm}`);
  console.log(`\n---\n`);

  // Parse JSON fields
  const voiceProfileParsed = {
    ...profile,
    commonPhrases: JSON.parse(profile.commonPhrases as string),
    industryJargon: JSON.parse(profile.industryJargon as string),
    exampleEmails: JSON.parse(profile.exampleEmails as string),
  };

  // Parse detailed report to extract top issues
  let topIssues: string[] = [];
  try {
    const report = JSON.parse(audit.detailedReport || "{}");
    topIssues = report.criticalIssues || [];
  } catch (e) {
    topIssues = ["Website audit completed"];
  }

  // Generate email
  const email = await generateEmailInVoice(voiceProfileParsed, {
    recipientName: "[Owner/Manager]",
    recipientCompany: lead.companyName,
    recipientWebsite: lead.websiteUrl,
    auditSummary: audit.summary || "",
    prestigeScore: audit.prestigeScore,
    topIssues,
  });

  console.log(`SUBJECT: ${email.subject}\n`);
  console.log(`TO: [Owner/Manager]\n`);
  console.log(`BODY:\n${email.body}\n`);
  console.log(`---\n`);
  console.log(`✅ Email generated successfully!`);
  console.log(`\nThis email would be sent to the approval queue where you can:`);
  console.log(`  1. Review the content`);
  console.log(`  2. Edit subject/body if needed`);
  console.log(`  3. Approve to send via Gmail`);
  console.log(`  4. Your edits train the AI to match your voice better`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
