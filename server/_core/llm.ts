import { ENV } from "./env";
import { trackApiCall, estimateLLMCost } from "../apiCostTracker";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// HTTP status codes that indicate a provider is unavailable/exhausted (not a bad request)
const TRANSIENT_STATUSES = new Set([412, 429, 500, 502, 503, 504]);

// Error text patterns that indicate quota/rate-limit exhaustion
const isQuotaError = (text: string) =>
  text.includes('usage exhausted') ||
  text.includes('quota') ||
  text.includes('rate limit') ||
  text.includes('rate_limit') ||
  text.includes('RESOURCE_EXHAUSTED') ||
  text.includes('overloaded') ||
  text.includes('capacity');

const shouldFallback = (status: number, errorText: string) =>
  TRANSIENT_STATUSES.has(status) || isQuotaError(errorText);

// ─── Provider implementations ──────────────────────────────────────────────

/** OpenAI-compatible endpoint (gpt-4o) */
async function tryOpenAI(
  params: InvokeParams,
  fmt: ReturnType<typeof normalizeResponseFormat>
): Promise<InvokeResult> {
  if (!ENV.openAiApiKey) throw new Error('SKIP: no OPENAI_API_KEY');

  const { messages, tools, toolChoice, tool_choice } = params;
  const payload: Record<string, unknown> = {
    model: 'gpt-4o',
    messages: messages.map(normalizeMessage),
    max_tokens: 16384,
  };
  if (tools?.length) payload.tools = tools;
  const tc = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (tc) payload.tool_choice = tc;
  if (fmt) payload.response_format = fmt;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ENV.openAiApiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`openai:${res.status}:${t.slice(0, 200)}`);
  }
  return res.json() as Promise<InvokeResult>;
}

/** Anthropic Claude (claude-3-5-sonnet) via OpenAI-compatible messages API */
async function tryAnthropic(
  params: InvokeParams,
  _fmt: ReturnType<typeof normalizeResponseFormat>
): Promise<InvokeResult> {
  if (!ENV.anthropicApiKey) throw new Error('SKIP: no ANTHROPIC_API_KEY');

  const { messages } = params;

  // Anthropic requires system message to be separate
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8192,
    messages: userMsgs.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  };
  if (systemMsg) {
    body.system = typeof systemMsg.content === 'string'
      ? systemMsg.content
      : JSON.stringify(systemMsg.content);
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ENV.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`anthropic:${res.status}:${t.slice(0, 200)}`);
  }
  const raw = await res.json() as {
    id: string; model: string;
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  // Normalize to OpenAI InvokeResult shape
  return {
    id: raw.id,
    created: Date.now(),
    model: raw.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: raw.content.map(c => c.text ?? '').join(''),
      },
      finish_reason: 'stop',
    }],
    usage: raw.usage ? {
      prompt_tokens: raw.usage.input_tokens,
      completion_tokens: raw.usage.output_tokens,
      total_tokens: raw.usage.input_tokens + raw.usage.output_tokens,
    } : undefined,
  };
}

/** Google Gemini via native REST API (supports AQ.* OAuth tokens and AIzaSy* API keys) */
async function tryGoogleGemini(
  params: InvokeParams,
  _fmt: ReturnType<typeof normalizeResponseFormat>
): Promise<InvokeResult> {
  if (!ENV.googleAiApiKey) throw new Error('SKIP: no GOOGLE_AI_API_KEY');

  const { messages } = params;

  // Convert OpenAI message format to Gemini native format
  const systemParts: string[] = [];
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    const text = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? (msg.content as Array<{text?: string}>).map(c => (c && typeof c === 'object' && 'text' in c ? (c as {text: string}).text : '')).join('')
        : '';

    if (msg.role === 'system') {
      systemParts.push(text);
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
  }

  const body: Record<string, unknown> = { contents };
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemParts.join('\n') }] };
  }

  // Determine auth header — AQ.* tokens use X-goog-api-key, AIzaSy* use same
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': ENV.googleAiApiKey,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`google:${res.status}:${t.slice(0, 200)}`);
  }

  const raw = await res.json() as {
    candidates: Array<{
      content: { parts: Array<{ text?: string }>; role: string };
      finishReason: string;
    }>;
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    modelVersion?: string;
    responseId?: string;
  };

  const candidate = raw.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text ?? '').join('') ?? '';

  // Normalize to OpenAI InvokeResult shape
  return {
    id: raw.responseId ?? `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: raw.modelVersion ?? 'gemini-flash-latest',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: candidate?.finishReason?.toLowerCase() ?? 'stop',
    }],
    usage: raw.usageMetadata ? {
      prompt_tokens: raw.usageMetadata.promptTokenCount,
      completion_tokens: raw.usageMetadata.candidatesTokenCount,
      total_tokens: raw.usageMetadata.totalTokenCount,
    } : undefined,
  };
}

// ─── Fallback chain ─────────────────────────────────────────────────────────

type ProviderFn = (
  params: InvokeParams,
  fmt: ReturnType<typeof normalizeResponseFormat>
) => Promise<InvokeResult>;

const FALLBACK_PROVIDERS: Array<{ name: string; fn: ProviderFn }> = [
  { name: 'openai', fn: tryOpenAI },
  { name: 'anthropic', fn: tryAnthropic },
  { name: 'google-gemini', fn: tryGoogleGemini },
];

async function runFallbackChain(
  params: InvokeParams,
  fmt: ReturnType<typeof normalizeResponseFormat>,
  primaryError: string
): Promise<InvokeResult> {
  const errors: string[] = [`manus: ${primaryError}`];

  for (const { name, fn } of FALLBACK_PROVIDERS) {
    try {
      const result = await fn(params, fmt);
      console.log(`[LLM] ✓ Succeeded via fallback provider: ${name}`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('SKIP:')) {
        // Key not configured — skip silently
        continue;
      }
      console.warn(`[LLM] ✗ Fallback provider ${name} failed: ${msg.slice(0, 120)}`);
      errors.push(`${name}: ${msg.slice(0, 120)}`);
    }
  }

  throw new Error(
    `All AI providers exhausted. Errors:\n${errors.map(e => `  • ${e}`).join('\n')}`
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  const payload: Record<string, unknown> = {
    model: 'gemini-2.5-flash',
    messages: messages.map(normalizeMessage),
    max_tokens: 32768,
    thinking: { budget_tokens: 128 },
  };

  if (tools?.length) payload.tools = tools;

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;

  const response = await fetch(resolveApiUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (shouldFallback(response.status, errorText)) {
      console.warn(
        `[LLM] Manus AI returned ${response.status} — starting fallback chain. Reason: ${errorText.slice(0, 120)}`
      );
      return runFallbackChain(params, normalizedResponseFormat, `${response.status} ${errorText.slice(0, 120)}`);
    }
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const result = (await response.json()) as InvokeResult;

  // Track API cost (async, don't block response)
  if (result.usage) {
    const costCents = estimateLLMCost(
      result.usage.prompt_tokens,
      result.usage.completion_tokens
    );
    trackApiCall({
      userId: 0,
      service: 'llm',
      operation: 'chat_completion',
      tokensUsed: result.usage.total_tokens,
      estimatedCostCents: costCents,
      requestData: {
        model: result.model,
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
      },
      responseStatus: 'success',
    }).catch(err => console.error('[LLM] Cost tracking failed:', err));
  }

  return result;
}
