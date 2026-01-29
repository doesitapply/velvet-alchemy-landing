# Multi-Provider AI API Architecture

## Overview

Velvet Alchemy uses multiple AI providers with automatic failover to ensure 100% uptime even when rate limits are hit. The system automatically switches between providers based on availability, cost, and performance.

## Supported Providers

1. **Manus AI** (Primary) - Built-in, no API key needed
2. **OpenAI** (GPT-4o, GPT-4-turbo) - Requires API key
3. **Anthropic** (Claude 3.5 Sonnet, Claude 3 Opus) - Requires API key
4. **Google AI** (Gemini 1.5 Pro) - Requires API key

## Architecture

### Database Schema

```sql
-- AI provider configurations
CREATE TABLE ai_providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE, -- 'manus', 'openai', 'anthropic', 'google'
  displayName VARCHAR(100) NOT NULL,
  apiKey TEXT, -- Encrypted, NULL for Manus (uses built-in)
  isEnabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0, -- Lower = higher priority
  maxRequestsPerMinute INT,
  maxTokensPerDay INT,
  costPer1kTokens DECIMAL(10, 6), -- USD
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Track API usage for cost monitoring
CREATE TABLE api_usage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  providerId INT NOT NULL,
  operation VARCHAR(100) NOT NULL, -- 'visual_audit', 'email_generation', 'asset_generation'
  model VARCHAR(100), -- 'gpt-4o', 'claude-3-5-sonnet', etc.
  promptTokens INT NOT NULL,
  completionTokens INT NOT NULL,
  totalTokens INT NOT NULL,
  cost DECIMAL(10, 6), -- USD
  latencyMs INT, -- Response time
  success BOOLEAN NOT NULL,
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES ai_providers(id)
);

-- Track provider health and availability
CREATE TABLE provider_health (
  id INT AUTO_INCREMENT PRIMARY KEY,
  providerId INT NOT NULL,
  status ENUM('healthy', 'degraded', 'down') NOT NULL DEFAULT 'healthy',
  lastSuccessAt TIMESTAMP,
  lastFailureAt TIMESTAMP,
  consecutiveFailures INT NOT NULL DEFAULT 0,
  avgLatencyMs INT,
  successRate DECIMAL(5, 2), -- Percentage (0-100)
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES ai_providers(id),
  UNIQUE KEY (providerId)
);
```

### Provider Abstraction Layer

All AI calls go through a unified `invokeAI()` function that:

1. **Selects provider** based on priority and health
2. **Executes request** with provider-specific client
3. **Handles errors** (rate limits, timeouts, failures)
4. **Logs usage** (tokens, cost, latency)
5. **Updates health** (success/failure tracking)
6. **Retries with fallback** if primary fails

```typescript
interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  invoke(params: AIRequest): Promise<AIResponse>;
  estimateCost(tokens: number): number;
}

interface AIRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_schema';
  schema?: object;
}

interface AIResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: string;
  latencyMs: number;
}
```

### Failover Logic

```
1. Get enabled providers sorted by priority
2. For each provider:
   a. Check health status (skip if 'down')
   b. Check rate limits (skip if exceeded)
   c. Try API call
   d. If success → log usage, update health, return response
   e. If rate limit error → mark degraded, try next provider
   f. If other error → increment failure count, try next provider
3. If all providers fail → throw error with details
```

### Rate Limit Detection

Each provider has specific error codes for rate limits:

- **OpenAI**: `429` status code, error type `rate_limit_exceeded`
- **Anthropic**: `429` status code, error type `rate_limit_error`
- **Google**: `429` status code, error message contains "quota exceeded"
- **Manus**: Custom error handling from built-in API

### Cost Tracking

Track costs per provider to optimize spending:

```typescript
// Example costs (as of 2026)
const COST_PER_1K_TOKENS = {
  'gpt-4o': 0.005, // $5 per 1M tokens
  'gpt-4-turbo': 0.01,
  'claude-3-5-sonnet': 0.003,
  'claude-3-opus': 0.015,
  'gemini-1.5-pro': 0.00125,
  'manus-ai': 0.002, // Estimated based on Manus credits
};
```

### Health Monitoring

Provider health is calculated based on:

- **Success rate** (last 100 requests)
- **Average latency** (last 100 requests)
- **Consecutive failures** (mark 'down' after 5 failures)
- **Last success/failure timestamp**

Status transitions:
- `healthy` → `degraded` (success rate < 90% or avg latency > 5s)
- `degraded` → `down` (5 consecutive failures)
- `down` → `healthy` (successful request after cooldown period)

## Admin UI

### Provider Management Page (`/admin/providers`)

Features:
- **Provider list** with status indicators (healthy/degraded/down)
- **Add/edit API keys** (encrypted storage)
- **Enable/disable providers**
- **Set priority order** (drag-and-drop)
- **View usage stats** (requests, tokens, cost)
- **Health dashboard** (success rate, latency, uptime)

### Cost Dashboard (`/admin/costs`)

Features:
- **Daily/weekly/monthly cost breakdown** by provider
- **Cost per operation** (visual audit, email generation, asset generation)
- **Budget alerts** (notify when approaching limits)
- **Cost optimization recommendations**

## Migration Strategy

1. **Phase 1**: Add database tables, no code changes
2. **Phase 2**: Implement provider abstraction layer
3. **Phase 3**: Migrate existing `invokeLLM()` calls to `invokeAI()`
4. **Phase 4**: Add OpenAI, Anthropic, Google integrations
5. **Phase 5**: Build admin UI
6. **Phase 6**: Enable automatic failover

## Testing Strategy

### Unit Tests

- Provider selection logic
- Rate limit detection
- Failover scenarios
- Cost calculation
- Health status updates

### Integration Tests

- OpenAI API calls
- Anthropic API calls
- Google AI API calls
- Manus AI API calls
- Failover between providers

### Load Tests

- Intentionally trigger rate limits
- Verify automatic failover
- Measure latency impact
- Validate cost tracking accuracy

## Security Considerations

- **API keys encrypted** at rest (AES-256)
- **Keys never logged** or exposed in errors
- **Admin UI requires authentication**
- **Rate limit per user** to prevent abuse
- **Audit log** for all provider changes

## Future Enhancements

- **Smart routing** (choose cheapest provider for simple tasks)
- **Model selection** (GPT-4o for complex, GPT-3.5 for simple)
- **Caching** (avoid duplicate API calls)
- **Batch processing** (group requests to save costs)
- **Provider benchmarking** (A/B test quality across providers)
