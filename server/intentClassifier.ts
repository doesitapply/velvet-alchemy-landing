import { invokeAI } from "./aiProvider";
import { getDb } from "./db";
import { intentClassifications, emailMessages, autoResponses, emailThreads } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Intent Classification Service
 * Analyzes lead replies and classifies their intent
 */

export type Intent = "interested" | "objection" | "not_now" | "spam" | "unsubscribe";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  reasoning: string;
}

/**
 * Classify the intent of a lead's reply
 */
export async function classifyIntent(messageBody: string): Promise<IntentResult> {
  const prompt = `Analyze this email reply and classify the sender's intent.

Email: ${messageBody}

Classify as ONE of:
- interested: Wants to learn more, book demo, or buy
- objection: Has concerns (price, timing, trust, already has solution)
- not_now: Interested but not ready (follow up later)
- spam: Auto-reply, out-of-office, or irrelevant
- unsubscribe: Wants to stop receiving emails

Return JSON with this exact structure:
{
  "intent": "interested",
  "confidence": 0.95,
  "reasoning": "They asked about pricing and availability"
}`;

  try {
    const response = await invokeAI({
      messages: [
        { role: "system", content: "You are an expert at analyzing email intent. Always return valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "intent_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                enum: ["interested", "objection", "not_now", "spam", "unsubscribe"],
                description: "The classified intent"
              },
              confidence: {
                type: "number",
                description: "Confidence score from 0.0 to 1.0"
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of why this intent was chosen"
              }
            },
            required: ["intent", "confidence", "reasoning"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);

    return {
      intent: result.intent as Intent,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  } catch (error: any) {
    console.error("[Intent Classifier] Error:", error.message);
    // Default to "spam" if classification fails
    return {
      intent: "spam",
      confidence: 0.5,
      reasoning: `Classification failed: ${error.message}`
    };
  }
}

/**
 * Process a new reply: classify intent and trigger appropriate action
 */
export async function processReply(messageId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Intent Classifier] Database not available");
    return;
  }

  // Get message
  const messageResult = await db.select().from(emailMessages).where(eq(emailMessages.id, messageId)).limit(1);
  if (messageResult.length === 0) {
    console.error(`[Intent Classifier] Message ${messageId} not found`);
    return;
  }
  const message = messageResult[0];

  console.log(`[Intent Classifier] Processing reply in thread ${message.threadId}`);

  // Classify intent
  const intent = await classifyIntent(message.bodyText);

  console.log(`[Intent Classifier] Classified as "${intent.intent}" (confidence: ${intent.confidence})`);

  // Save classification
  await db.insert(intentClassifications).values({
    messageId: message.id,
    intent: intent.intent,
    confidence: intent.confidence,
    reasoning: intent.reasoning,
  });

  // Take action based on intent
  await handleIntent(message.threadId, message.id, intent);
}

/**
 * Handle classified intent and trigger appropriate action
 */
async function handleIntent(threadId: number, messageId: number, intent: IntentResult): Promise<void> {
  const db = await getDb();
  if (!db) return;

  switch (intent.intent) {
    case "interested":
      // Generate response offering demo/pricing
      await generateAutoResponse(threadId, messageId, "interested");
      break;

    case "objection":
      // Generate response addressing concern (requires approval)
      await generateAutoResponse(threadId, messageId, "objection");
      break;

    case "not_now":
      // Schedule follow-up in 30 days
      console.log(`[Intent Classifier] Scheduling 30-day follow-up for thread ${threadId}`);
      // TODO: Implement 30-day follow-up scheduling
      break;

    case "unsubscribe":
      // Close thread and stop all emails
      await db.update(emailThreads).set({
        status: "closed_lost",
      }).where(eq(emailThreads.id, threadId));
      console.log(`[Intent Classifier] Closed thread ${threadId} (unsubscribe request)`);
      break;

    case "spam":
      // Do nothing
      console.log(`[Intent Classifier] Ignoring spam message in thread ${threadId}`);
      break;
  }
}

/**
 * Generate auto-response based on intent
 */
async function generateAutoResponse(threadId: number, inReplyToMessageId: number, intentType: "interested" | "objection"): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get thread and message context
  const threadResult = await db.select().from(emailThreads).where(eq(emailThreads.id, threadId)).limit(1);
  if (threadResult.length === 0) return;
  const thread = threadResult[0];

  const messageResult = await db.select().from(emailMessages).where(eq(emailMessages.id, inReplyToMessageId)).limit(1);
  if (messageResult.length === 0) return;
  const message = messageResult[0];

  // Generate response
  let prompt = "";
  if (intentType === "interested") {
    prompt = `The lead replied with interest to our website audit outreach. Generate a response that:
1. Thanks them for their interest
2. Proposes 2-3 demo time slots (next 3 business days, 10am-4pm EST)
3. Mentions our pricing tiers (Basic $497, Pro $1,497, Premium $3,497)
4. Keeps the sarcastic, approachable tone
5. Signs off as "Cameron"

Their reply: ${message.bodyText}

Generate:
- Subject line (keep it short, reference their reply)
- Email body (3-4 paragraphs max)`;
  } else {
    prompt = `The lead replied with an objection to our website audit outreach. Generate a response that:
1. Acknowledges their concern without being defensive
2. Addresses the specific objection with facts/social proof
3. Offers to answer questions
4. Keeps the sarcastic but helpful tone
5. Signs off as "Cameron"

Their reply: ${message.bodyText}

Generate:
- Subject line (reference their concern)
- Email body (2-3 paragraphs, address objection directly)`;
  }

  try {
    const response = await invokeAI({
      messages: [
        { role: "system", content: "You are Cameron, a sarcastic but helpful website consultant. Write emails that are funny, direct, and convert." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Email subject line" },
              body: { type: "string", description: "Email body text" }
            },
            required: ["subject", "body"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    const email = JSON.parse(content);

    // Determine if auto-send or requires approval
    const requiresApproval = intentType === "objection"; // Objections need human review

    // Insert into auto_responses
    await db.insert(autoResponses).values({
      threadId,
      inReplyToMessageId,
      subject: email.subject,
      bodyText: email.body,
      bodyHtml: email.body,
      status: requiresApproval ? "pending_approval" : "approved",
      autoSendAt: requiresApproval ? null : new Date(),
    });

    console.log(`[Intent Classifier] Generated ${requiresApproval ? "pending" : "auto-send"} response for thread ${threadId}`);
  } catch (error: any) {
    console.error(`[Intent Classifier] Failed to generate response:`, error.message);
  }
}

/**
 * Process all unclassified replies
 */
export async function processUnclassifiedReplies(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get messages from "them" that don't have classifications yet
  const unclassified = await db
    .select()
    .from(emailMessages)
    .leftJoin(intentClassifications, eq(emailMessages.id, intentClassifications.messageId))
    .where(eq(emailMessages.sender, "them"))
    .limit(10); // Process 10 at a time

  for (const row of unclassified) {
    if (!row.intent_classifications) {
      // No classification exists
      await processReply(row.email_messages.id);
    }
  }
}
