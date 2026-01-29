/**
 * Initialize voice profile from Gmail sent emails
 * Run with: tsx scripts/init-voice-profile.ts
 */

import { readFileSync } from "fs";
import { analyzeVoice } from "../server/voiceAnalyzer";
import { getDb } from "../server/db";
import { voiceProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Read Gmail search results
  const gmailData = JSON.parse(
    readFileSync("/tmp/manus-mcp/mcp_result_80d8c75d1dea441ab5c87d904d31663f.json", "utf-8")
  );

  // Extract business-focused emails (filter out legal/court emails)
  const businessEmails = gmailData.result.threads
    .filter((thread: any) => {
      const subject = thread.messages[0]?.pickedHeaders?.subject || "";
      // Filter out legal emails
      return !subject.includes("Filing:") && 
             !subject.includes("ECF") && 
             !subject.includes("Court") &&
             !subject.includes("Plaintiff");
    })
    .map((thread: any) => {
      const msg = thread.messages[0];
      return {
        subject: msg.pickedHeaders?.subject || "",
        body: msg.pickedPlainContent || msg.pickedMarkdownContent || "",
        to: msg.pickedHeaders?.to || "",
        date: new Date(parseInt(msg.internalDate)).toISOString(),
      };
    })
    .filter((email: any) => email.body.length > 50); // Filter out very short emails

  console.log(`Found ${businessEmails.length} business emails to analyze`);
  console.log("\nSample emails:");
  businessEmails.forEach((email: any, i: number) => {
    console.log(`${i + 1}. ${email.subject}`);
  });

  if (businessEmails.length === 0) {
    console.error("No business emails found. Need at least 1 email to analyze.");
    process.exit(1);
  }

  // Analyze voice
  console.log("\nAnalyzing voice...");
  const voiceProfile = await analyzeVoice(businessEmails);

  console.log("\nVoice Profile:");
  console.log(`- Formality: ${voiceProfile.formality}`);
  console.log(`- Directness: ${voiceProfile.directness}`);
  console.log(`- Enthusiasm: ${voiceProfile.enthusiasm}`);
  console.log(`- Avg Sentence Length: ${voiceProfile.avgSentenceLength} words`);
  console.log(`- Uses Contractions: ${voiceProfile.usesContractions}`);
  console.log(`- Uses Profanity: ${voiceProfile.usesProfanity}`);
  console.log(`- Common Phrases: ${voiceProfile.commonPhrases.join(", ")}`);
  console.log(`- Sign-off: ${voiceProfile.signOffStyle}`);
  console.log(`- Greeting: ${voiceProfile.greetingStyle}`);

  // Save to database (user ID 1 - owner)
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  const userId = 1; // Owner's user ID

  // Check if profile exists
  const existing = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, userId)).limit(1);

  if (existing.length > 0) {
    console.log("\nUpdating existing voice profile...");
    await db.update(voiceProfiles).set({
      formality: voiceProfile.formality,
      directness: voiceProfile.directness,
      enthusiasm: voiceProfile.enthusiasm,
      avgSentenceLength: voiceProfile.avgSentenceLength,
      avgParagraphLength: voiceProfile.avgParagraphLength,
      usesContractions: voiceProfile.usesContractions,
      usesEmoji: voiceProfile.usesEmoji,
      usesProfanity: voiceProfile.usesProfanity,
      commonPhrases: JSON.stringify(voiceProfile.commonPhrases),
      industryJargon: JSON.stringify(voiceProfile.industryJargon),
      signOffStyle: voiceProfile.signOffStyle,
      greetingStyle: voiceProfile.greetingStyle,
      usesLists: voiceProfile.usesLists,
      usesBoldText: voiceProfile.usesBoldText,
      usesQuestions: voiceProfile.usesQuestions,
      exampleEmails: JSON.stringify(voiceProfile.exampleEmails),
      updatedAt: new Date(),
    }).where(eq(voiceProfiles.userId, userId));
  } else {
    console.log("\nCreating new voice profile...");
    await db.insert(voiceProfiles).values({
      userId,
      formality: voiceProfile.formality,
      directness: voiceProfile.directness,
      enthusiasm: voiceProfile.enthusiasm,
      avgSentenceLength: voiceProfile.avgSentenceLength,
      avgParagraphLength: voiceProfile.avgParagraphLength,
      usesContractions: voiceProfile.usesContractions,
      usesEmoji: voiceProfile.usesEmoji,
      usesProfanity: voiceProfile.usesProfanity,
      commonPhrases: JSON.stringify(voiceProfile.commonPhrases),
      industryJargon: JSON.stringify(voiceProfile.industryJargon),
      signOffStyle: voiceProfile.signOffStyle,
      greetingStyle: voiceProfile.greetingStyle,
      usesLists: voiceProfile.usesLists,
      usesBoldText: voiceProfile.usesBoldText,
      usesQuestions: voiceProfile.usesQuestions,
      exampleEmails: JSON.stringify(voiceProfile.exampleEmails),
    });
  }

  console.log("\n✅ Voice profile saved successfully!");
  console.log("\nNext steps:");
  console.log("1. Visit /voice-setup to see your profile");
  console.log("2. Go to any lead detail page and click 'Generate AI Outreach'");
  console.log("3. Review the generated email at /outreach-approval");
  console.log("4. After approving 5 emails, your voice will be fully calibrated");

  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
