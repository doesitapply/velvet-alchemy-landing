/**
 * Multi-Provider AI Abstraction Layer
 * 
 * Provides automatic failover between AI providers (Manus, OpenAI, Anthropic, Google)
 * when rate limits are hit. Tracks usage, cost, and health for each provider.
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { aiProviders, apiUsageLogs, providerHealth } from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

// Types
export interface AIRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_schema";
  schema?: object;
}

export interface AIResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: string;
  latencyMs: number;
  cost: number; // in cents
}

export interface AIProvider {
  id: number;
  name: string;
  displayName: string;
  apiKey: string | null;
  isEnabled: boolean;
  priority: number;
  costPer1kTokens: number; // in cents
}

// Rate limit error detection
function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  const errorStr = JSON.stringify(error).toLowerCase();
  
  return (
    errorStr.includes("rate limit") ||
    errorStr.includes("rate_limit") ||
    errorStr.includes("quota exceeded") ||
    errorStr.includes("too many requests") ||
    errorStr.includes("429") ||
    (error.status === 429) ||
    (error.code === "rate_limit_exceeded")
  );
}

// Calculate cost based on tokens and provider pricing
function calculateCost(tokens: number, costPer1kTokens: number): number {
  return Math.ceil((tokens / 1000) * costPer1kTokens);
}

// Update provider health after each request
async function updateProviderHealth(
  providerId: number,
  success: boolean,
  latencyMs: number
) {
  const db = await getDb();
  if (!db) return;

  try {
    // Get current health record
    const healthRecords = await db
      .select()
      .from(providerHealth)
      .where(eq(providerHealth.providerId, providerId))
      .limit(1);

    const now = new Date();

    if (healthRecords.length === 0) {
      // Create new health record
      await db.insert(providerHealth).values({
        providerId,
        status: success ? "healthy" : "degraded",
        lastSuccessAt: success ? now : null,
        lastFailureAt: success ? null : now,
        consecutiveFailures: success ? 0 : 1,
        avgLatencyMs: latencyMs,
        successRate: success ? 10000 : 0, // 100.00% or 0%
      });
    } else {
      const health = healthRecords[0];
      const consecutiveFailures = success ? 0 : (health.consecutiveFailures + 1);
      
      // Determine new status
      let status: "healthy" | "degraded" | "down" = "healthy";
      if (consecutiveFailures >= 5) {
        status = "down";
      } else if (consecutiveFailures >= 2) {
        status = "degraded";
      }

      // Update health record
      await db.update(providerHealth)
        .set({
          status,
          lastSuccessAt: success ? now : health.lastSuccessAt,
          lastFailureAt: success ? health.lastFailureAt : now,
          consecutiveFailures,
          avgLatencyMs: health.avgLatencyMs
            ? Math.floor((health.avgLatencyMs + latencyMs) / 2)
            : latencyMs,
        })
        .where(eq(providerHealth.providerId, providerId));
    }
  } catch (error) {
    console.error("[AI Provider] Failed to update health:", error);
  }
}

// Log API usage for cost tracking
async function logAPIUsage(
  providerId: number,
  operation: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  cost: number,
  latencyMs: number,
  success: boolean,
  errorMessage?: string,
  userId?: number,
  leadId?: number
) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(apiUsageLogs).values({
      providerId,
      userId: userId || null,
      leadId: leadId || null,
      operation,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      latencyMs,
      success,
      errorMessage: errorMessage || null,
    });
  } catch (error) {
    console.error("[AI Provider] Failed to log usage:", error);
  }
}

// Get enabled providers sorted by priority
async function getEnabledProviders(): Promise<AIProvider[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const providers = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.isEnabled, true))
      .orderBy(asc(aiProviders.priority));

    return providers as AIProvider[];
  } catch (error) {
    console.error("[AI Provider] Failed to get providers:", error);
    return [];
  }
}

// Invoke Manus AI (built-in)
async function invokeManusAI(request: AIRequest): Promise<AIResponse> {
  const startTime = Date.now();
  
  const response = await invokeLLM({
    messages: request.messages,
    max_tokens: request.maxTokens,
    response_format: request.responseFormat === "json_schema" ? {
      type: "json_schema",
      json_schema: request.schema as any,
    } : undefined,
  });

  const latencyMs = Date.now() - startTime;
  const choice = response.choices[0];
  const usage = response.usage;

  // Extract content (handle both string and array types)
  const content = typeof choice.message.content === "string" 
    ? choice.message.content 
    : Array.isArray(choice.message.content)
      ? choice.message.content.map(c => c.type === "text" ? c.text : "").join("")
      : "";

  return {
    content,
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
    totalTokens: usage?.total_tokens || 0,
    model: response.model || "manus-ai",
    provider: "manus",
    latencyMs,
    cost: 0, // Calculated by caller
  };
}

// Invoke OpenAI (requires API key)
async function invokeOpenAI(request: AIRequest, apiKey: string): Promise<AIResponse> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  
  const startTime = Date.now();
  
  const response = await client.chat.completions.create({
    model: request.model || "gpt-4o",
    messages: request.messages,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    response_format: request.responseFormat === "json_schema" ? {
      type: "json_schema" as const,
      json_schema: request.schema as any,
    } : undefined,
  });

  const latencyMs = Date.now() - startTime;
  const choice = response.choices[0];
  const usage = response.usage;

  return {
    content: choice.message.content || "",
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
    totalTokens: usage?.total_tokens || 0,
    model: response.model,
    provider: "openai",
    latencyMs,
    cost: 0, // Calculated by caller
  };
}

// Invoke Anthropic (requires API key)
async function invokeAnthropic(request: AIRequest, apiKey: string): Promise<AIResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  
  const startTime = Date.now();
  
  // Separate system messages from user/assistant messages
  const systemMessages = request.messages.filter(m => m.role === "system");
  const otherMessages = request.messages.filter(m => m.role !== "system");
  const systemPrompt = systemMessages.map(m => m.content).join("\n\n");
  
  const response = await client.messages.create({
    model: request.model || "claude-3-5-sonnet-20241022",
    max_tokens: request.maxTokens || 4096,
    system: systemPrompt || undefined,
    messages: otherMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    temperature: request.temperature,
  });

  const latencyMs = Date.now() - startTime;
  const content = response.content[0].type === "text" ? response.content[0].text : "";

  return {
    content,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    model: response.model,
    provider: "anthropic",
    latencyMs,
    cost: 0, // Calculated by caller
  };
}

// Invoke Google AI (requires API key)
async function invokeGoogleAI(request: AIRequest, apiKey: string): Promise<AIResponse> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: request.model || "gemini-1.5-pro" });
  
  const startTime = Date.now();
  
  // Convert messages to Gemini format
  const systemMessages = request.messages.filter(m => m.role === "system");
  const otherMessages = request.messages.filter(m => m.role !== "system");
  const systemInstruction = systemMessages.map(m => m.content).join("\n\n");
  
  const history = otherMessages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  
  const lastMessage = otherMessages[otherMessages.length - 1];
  
  const chat = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: request.maxTokens,
      temperature: request.temperature,
    },
  });
  
  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;

  const latencyMs = Date.now() - startTime;
  const content = response.text();

  // Gemini doesn't provide detailed token counts in the same way
  const totalTokens = response.usageMetadata?.totalTokenCount || 0;
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    model: request.model || "gemini-1.5-pro",
    provider: "google",
    latencyMs,
    cost: 0, // Calculated by caller
  };
}

/**
 * Main AI invocation function with automatic failover
 * 
 * Tries providers in priority order until one succeeds.
 * Automatically switches to next provider if rate limit is hit.
 * Logs usage and updates health for each attempt.
 */
export async function invokeAI(
  request: AIRequest,
  options?: {
    operation?: string;
    userId?: number;
    leadId?: number;
  }
): Promise<AIResponse> {
  // Delegate directly to invokeLLM which has the full multi-provider fallback chain
  // (Manus AI → OpenAI → Anthropic → Google Gemini) built in.
  // This avoids the old DB-driven provider loop which required packages that are no longer installed.
  const startTime = Date.now();

  const llmResponse = await invokeLLM({
    messages: request.messages,
    max_tokens: request.maxTokens,
    response_format: request.responseFormat === "json_schema" ? {
      type: "json_schema",
      json_schema: request.schema as any,
    } : undefined,
  });

  const latencyMs = Date.now() - startTime;
  const choice = llmResponse.choices[0];
  const usage = llmResponse.usage;

  const content = typeof choice.message.content === "string"
    ? choice.message.content
    : Array.isArray(choice.message.content)
      ? (choice.message.content as Array<{ type: string; text?: string }>)
          .map(c => c.type === "text" ? (c.text ?? "") : "").join("")
      : "";

  return {
    content,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    model: llmResponse.model ?? "unknown",
    provider: "auto",
    latencyMs,
    cost: 0,
  };
}
