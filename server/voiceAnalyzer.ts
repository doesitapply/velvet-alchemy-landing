import { invokeAI } from "./aiProvider";

/**
 * Voice Analyzer
 * Analyzes user's existing emails to extract writing style and personality
 * Used to train AI to match user's voice in outreach emails
 */

export interface VoiceProfile {
  // Tone characteristics
  formality: "casual" | "professional" | "technical" | "mixed";
  directness: "blunt" | "direct" | "diplomatic" | "verbose";
  enthusiasm: "high" | "moderate" | "low" | "neutral";
  
  // Writing patterns
  avgSentenceLength: number; // words per sentence
  avgParagraphLength: number; // sentences per paragraph
  usesContractions: boolean; // "don't" vs "do not"
  usesEmoji: boolean;
  usesProfanity: boolean; // "shit", "damn", etc.
  
  // Vocabulary
  commonPhrases: string[]; // "let's", "honestly", "basically"
  industryJargon: string[]; // technical terms
  signOffStyle: string; // "Cheers", "Best", "Thanks"
  greetingStyle: string; // "Hey", "Hi", "Hello"
  
  // Structure
  usesLists: boolean;
  usesBoldText: boolean;
  usesQuestions: boolean;
  
  // Examples
  exampleEmails: string[]; // 3-5 representative emails
}

export interface EmailSample {
  subject: string;
  body: string;
  to: string;
  date: Date;
}

/**
 * Analyze a collection of user's sent emails to extract voice profile
 */
export async function analyzeVoice(emails: EmailSample[]): Promise<VoiceProfile> {
  if (emails.length === 0) {
    throw new Error("Need at least 1 email to analyze voice");
  }

  // Prepare email samples for LLM analysis
  const emailTexts = emails.map((e, i) => `
EMAIL ${i + 1}:
Subject: ${e.subject}
To: ${e.to}
Body:
${e.body}
---
  `).join("\n");

  const analysisPrompt = `You are a writing style analyst. Analyze these emails and extract the sender's writing voice profile.

${emailTexts}

Extract the following characteristics:

1. FORMALITY LEVEL:
   - casual (uses slang, contractions, informal language)
   - professional (polished but approachable)
   - technical (precise, jargon-heavy)
   - mixed (adapts based on recipient)

2. DIRECTNESS:
   - blunt (no fluff, straight to the point)
   - direct (clear but polite)
   - diplomatic (careful, considerate)
   - verbose (detailed, explanatory)

3. ENTHUSIASM:
   - high (exclamation points, energy)
   - moderate (balanced)
   - low (reserved, understated)
   - neutral (matter-of-fact)

4. WRITING PATTERNS:
   - Average sentence length (estimate in words)
   - Average paragraph length (estimate in sentences)
   - Uses contractions? (yes/no)
   - Uses emoji? (yes/no)
   - Uses profanity? (yes/no)

5. VOCABULARY:
   - List 5-10 common phrases/words this person uses frequently
   - List any industry jargon or technical terms
   - Typical sign-off (e.g., "Cheers", "Best regards")
   - Typical greeting (e.g., "Hey", "Hi there")

6. STRUCTURE:
   - Uses bullet lists? (yes/no)
   - Uses bold/emphasis? (yes/no)
   - Asks questions? (yes/no)

Return your analysis as JSON matching this structure:
{
  "formality": "casual" | "professional" | "technical" | "mixed",
  "directness": "blunt" | "direct" | "diplomatic" | "verbose",
  "enthusiasm": "high" | "moderate" | "low" | "neutral",
  "avgSentenceLength": number,
  "avgParagraphLength": number,
  "usesContractions": boolean,
  "usesEmoji": boolean,
  "usesProfanity": boolean,
  "commonPhrases": string[],
  "industryJargon": string[],
  "signOffStyle": string,
  "greetingStyle": string,
  "usesLists": boolean,
  "usesBoldText": boolean,
  "usesQuestions": boolean
}`;

  const response = await invokeAI({
    messages: [
      { role: "system", content: "You are a writing style analyst. Return only valid JSON." },
      { role: "user", content: analysisPrompt },
    ],
    responseFormat: "json_schema",
    schema: {

        name: "voice_profile",
        strict: true,
        schema: {
          type: "object",
          properties: {
            formality: { type: "string", enum: ["casual", "professional", "technical", "mixed"] },
            directness: { type: "string", enum: ["blunt", "direct", "diplomatic", "verbose"] },
            enthusiasm: { type: "string", enum: ["high", "moderate", "low", "neutral"] },
            avgSentenceLength: { type: "number" },
            avgParagraphLength: { type: "number" },
            usesContractions: { type: "boolean" },
            usesEmoji: { type: "boolean" },
            usesProfanity: { type: "boolean" },
            commonPhrases: { type: "array", items: { type: "string" } },
            industryJargon: { type: "array", items: { type: "string" } },
            signOffStyle: { type: "string" },
            greetingStyle: { type: "string" },
            usesLists: { type: "boolean" },
            usesBoldText: { type: "boolean" },
            usesQuestions: { type: "boolean" },
          },
          required: [
            "formality", "directness", "enthusiasm",
            "avgSentenceLength", "avgParagraphLength",
            "usesContractions", "usesEmoji", "usesProfanity",
            "commonPhrases", "industryJargon",
            "signOffStyle", "greetingStyle",
            "usesLists", "usesBoldText", "usesQuestions"
          ],
          additionalProperties: false,
        },
      },
  });

  if (!response.content) {
    throw new Error("No response from LLM");
  }

  const profile = JSON.parse(response.content) as Omit<VoiceProfile, "exampleEmails">;

  // Select 3-5 most representative emails as examples
  const exampleCount = Math.min(5, emails.length);
  const exampleEmails = emails
    .slice(0, exampleCount)
    .map(e => `Subject: ${e.subject}\n\n${e.body}`);

  return {
    ...profile,
    exampleEmails,
  };
}

/**
 * Generate an email in the user's voice
 */
export async function generateEmailInVoice(
  voiceProfile: VoiceProfile,
  context: {
    recipientName: string;
    recipientCompany: string;
    recipientWebsite: string;
    auditSummary: string;
    prestigeScore: number;
    topIssues: string[];
  }
): Promise<{ subject: string; body: string }> {
  const voiceInstructions = `
VOICE PROFILE:
- Formality: ${voiceProfile.formality}
- Directness: ${voiceProfile.directness}
- Enthusiasm: ${voiceProfile.enthusiasm}
- Sentence length: ${voiceProfile.avgSentenceLength} words average
- Paragraph length: ${voiceProfile.avgParagraphLength} sentences average
- Uses contractions: ${voiceProfile.usesContractions ? "YES" : "NO"}
- Uses emoji: ${voiceProfile.usesEmoji ? "YES" : "NO"}
- Uses profanity: ${voiceProfile.usesProfanity ? "YES (keep it light)" : "NO"}
- Common phrases: ${Array.isArray(voiceProfile.commonPhrases) ? voiceProfile.commonPhrases.join(", ") : voiceProfile.commonPhrases}
- Sign-off: ${voiceProfile.signOffStyle}
- Greeting: ${voiceProfile.greetingStyle}
- Uses lists: ${voiceProfile.usesLists ? "YES" : "NO"}
- Uses bold: ${voiceProfile.usesBoldText ? "YES" : "NO"}
- Asks questions: ${voiceProfile.usesQuestions ? "YES" : "NO"}

EXAMPLE EMAILS (for reference):
${Array.isArray(voiceProfile.exampleEmails) ? voiceProfile.exampleEmails.slice(0, 2).join("\n\n---\n\n") : ""}
`;

  const emailPrompt = `You are writing a cold outreach email to a business owner. Write in the EXACT voice and style described below.

${voiceInstructions}

RECIPIENT INFO:
- Name: ${context.recipientName}
- Company: ${context.recipientCompany}
- Website: ${context.recipientWebsite}

AUDIT FINDINGS:
- Prestige Score: ${context.prestigeScore}/100
- Summary: ${context.auditSummary}
- Top Issues:
${context.topIssues.map((issue, i) => `  ${i + 1}. ${issue}`).join("\n")}

WRITING INSTRUCTIONS:
1. Open with humor/sarcasm about a specific fixable problem on their site
2. Use "Here's the thing" or similar casual transition
3. Explain why the problem costs them money (lost calls, missed leads)
4. Add "No judgment!" or similar self-aware comment
5. Use "The good news" / "The bad news" structure
6. List 3 specific fixes (bullet points)
7. Present pricing naturally (3 tiers: DIY $500, Done-For-You $2,500, Revenue Instrument $5,000)
8. End with low-pressure CTA ("Want me to send over the audit?")
9. Add self-aware P.S. ("I'm roasting because I care")

TONE RULES:
- Funny but not mean
- Sarcastic but helpful
- Only roast fixable problems (not their business/industry)
- Explain the joke ("Plot twist: minimalist ≠ invisible")
- Use emoji sparingly (1-2 max)
- Keep paragraphs short (2-3 sentences)
- Sound like a friend giving tough love, not a salesman

Return JSON with "subject" and "body" fields.`;

  const response = await invokeAI({
    messages: [
      { role: "system", content: "You are a cold email copywriter. Match the user's voice exactly. Return only valid JSON." },
      { role: "user", content: emailPrompt },
    ],
    responseFormat: "json_schema",
    schema: {

        name: "email_draft",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["subject", "body"],
          additionalProperties: false,
        },
      },
  });

  if (!response.content) {
    throw new Error("No response from LLM");
  }

  return JSON.parse(response.content);
}

/**
 * Refine voice profile based on user feedback
 */
export async function refineVoiceProfile(
  currentProfile: VoiceProfile,
  feedback: {
    emailGenerated: string;
    userEdits: string;
    feedbackNotes: string; // e.g., "too formal", "needs more energy"
  }
): Promise<VoiceProfile> {
  const refinementPrompt = `You are refining a voice profile based on user feedback.

CURRENT PROFILE:
${JSON.stringify(currentProfile, null, 2)}

EMAIL WE GENERATED:
${feedback.emailGenerated}

USER'S EDITED VERSION:
${feedback.userEdits}

USER FEEDBACK:
${feedback.feedbackNotes}

Analyze the differences between the generated email and the user's edits. Update the voice profile to better match the user's preferences.

Return the UPDATED voice profile as JSON with the same structure as the current profile.`;

  const response = await invokeAI({
    messages: [
      { role: "system", content: "You are a voice profile optimizer. Return only valid JSON." },
      { role: "user", content: refinementPrompt },
    ],
    responseFormat: "json_schema",
    schema: {

        name: "voice_profile",
        strict: true,
        schema: {
          type: "object",
          properties: {
            formality: { type: "string", enum: ["casual", "professional", "technical", "mixed"] },
            directness: { type: "string", enum: ["blunt", "direct", "diplomatic", "verbose"] },
            enthusiasm: { type: "string", enum: ["high", "moderate", "low", "neutral"] },
            avgSentenceLength: { type: "number" },
            avgParagraphLength: { type: "number" },
            usesContractions: { type: "boolean" },
            usesEmoji: { type: "boolean" },
            usesProfanity: { type: "boolean" },
            commonPhrases: { type: "array", items: { type: "string" } },
            industryJargon: { type: "array", items: { type: "string" } },
            signOffStyle: { type: "string" },
            greetingStyle: { type: "string" },
            usesLists: { type: "boolean" },
            usesBoldText: { type: "boolean" },
            usesQuestions: { type: "boolean" },
          },
          required: [
            "formality", "directness", "enthusiasm",
            "avgSentenceLength", "avgParagraphLength",
            "usesContractions", "usesEmoji", "usesProfanity",
            "commonPhrases", "industryJargon",
            "signOffStyle", "greetingStyle",
            "usesLists", "usesBoldText", "usesQuestions"
          ],
          additionalProperties: false,
        },
      },
  });

  if (!response.content) {
    throw new Error("No response from LLM");
  }

  const updatedProfile = JSON.parse(response.content) as Omit<VoiceProfile, "exampleEmails">;

  return {
    ...updatedProfile,
    exampleEmails: currentProfile.exampleEmails, // Keep existing examples
  };
}
