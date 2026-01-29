/**
 * Update voice profile to sarcastic, funny, approachable salesman
 * Run with: npx tsx scripts/update-voice-profile.ts
 */

import { getDb } from "../server/db";
import { voiceProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  const userId = 1; // Owner's user ID

  // New voice profile: Sarcastic, funny, approachable salesman
  const newProfile = {
    formality: "casual" as const,
    directness: "blunt" as const,
    enthusiasm: "moderate" as const,
    avgSentenceLength: 18, // Shorter, punchier
    avgParagraphLength: 3, // Shorter paragraphs for readability
    usesContractions: true,
    usesEmoji: true, // Occasional emoji for personality
    usesProfanity: false, // Keep it professional-ish
    commonPhrases: JSON.stringify([
      "Here's the thing",
      "Let me be real with you",
      "I'm not gonna sugarcoat it",
      "The good news is",
      "The bad news is",
      "Plot twist",
      "Here's where it gets interesting",
      "No judgment, but",
      "Real talk",
      "Between you and me",
    ]),
    industryJargon: JSON.stringify([
      "conversion funnel",
      "above the fold",
      "call to action",
      "bounce rate",
      "lead magnet",
      "revenue instrument",
    ]),
    signOffStyle: "Best regards,\n\nCameron\nVelvet Alchemy Team",
    greetingStyle: "Hi [Name], (or 'Hey there,' if name unknown)",
    usesLists: true, // Bullet points for clarity
    usesBoldText: true, // Emphasis on key points
    usesQuestions: true, // Rhetorical questions for engagement
    exampleEmails: JSON.stringify([
      `Subject: Your Website Is Doing That Thing Again

Hi Sarah,

I ran an automated audit on your restaurant's website and... okay, I'm just gonna say it: your homepage is committing a crime against hungry people.

Here's the thing—you've got a beautiful menu, great photos, and a 4.8-star rating. But when someone lands on your site, they have to scroll THREE TIMES to find your phone number. That's three opportunities for them to say "screw it" and order from the place with the big red "ORDER NOW" button.

No judgment! This happens to literally everyone. But here's the fix:

1. Phone number in the top right (always visible)
2. "Reserve a Table" button above the fold (big, red, impossible to miss)
3. Your 4.8-star rating front and center (social proof = trust)

I've got the full audit with mockups showing exactly how to fix this. Want me to send it over? Takes 5 minutes to review, and the changes are stupid simple.

Let me know!

Best regards,

Cameron
Velvet Alchemy Team`,

      `Subject: Quick Question About Your Plumbing Site

Hey Mike,

I was doing some competitive research in the Reno plumbing market and stumbled on your site. Gotta ask—did you know your "Contact Us" button is the same color as your background?

I'm not trying to be a jerk here. I'm genuinely curious if this is intentional or if your web designer ghosted you halfway through the project.

The reason I'm bringing this up: your site has GREAT reviews (4.6 stars!) and solid service area coverage. But if people can't figure out how to call you, they're just gonna hit the back button and call the next guy.

The good news? This is a 10-minute fix. Literally just change the button color to something that pops (orange, red, whatever matches your branding).

The bad news? Every day this stays broken, you're losing calls to competitors with worse reviews but better buttons.

I've got a full breakdown of what's working (your reviews, your service descriptions) and what's costing you money (invisible buttons, slow load times). Want me to send it over?

No pressure—just thought you'd want to know.

Best regards,

Cameron
Velvet Alchemy Team`,
    ]),
    calibrationCount: 0,
    isCalibrated: false,
    updatedAt: new Date(),
  };

  console.log("Updating voice profile to: Sarcastic, Funny, Approachable Salesman");
  console.log("- Formality: casual");
  console.log("- Directness: blunt");
  console.log("- Enthusiasm: moderate");
  console.log("- Tone: Funny, self-aware, roasts fixable problems, offers solutions");

  const existing = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, userId)).limit(1);

  if (existing.length > 0) {
    await db.update(voiceProfiles).set(newProfile).where(eq(voiceProfiles.userId, userId));
    console.log("\n✅ Voice profile updated!");
  } else {
    await db.insert(voiceProfiles).values({ userId, ...newProfile });
    console.log("\n✅ Voice profile created!");
  }

  console.log("\nNext: Run 'npx tsx scripts/test-outreach.ts 360002' to see the new voice in action");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
