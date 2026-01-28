# Technographic Hunter - Database Schema

## Core Tables

### `tech_signals` (Main Data Table)
```sql
CREATE TABLE tech_signals (
  id BIGSERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL UNIQUE,
  business_name VARCHAR(255),
  
  -- Contact Info
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Tech Stack Signals (Boolean flags for fast filtering)
  has_shopify BOOLEAN DEFAULT FALSE,
  has_stripe BOOLEAN DEFAULT FALSE,
  has_klaviyo BOOLEAN DEFAULT FALSE,
  has_google_analytics BOOLEAN DEFAULT FALSE,
  has_facebook_pixel BOOLEAN DEFAULT FALSE,
  has_openai_api BOOLEAN DEFAULT FALSE,
  has_broken_ssl BOOLEAN DEFAULT FALSE,
  has_wordpress BOOLEAN DEFAULT FALSE,
  has_woocommerce BOOLEAN DEFAULT FALSE,
  
  -- Signal Metadata (JSON for flexible querying)
  detected_technologies JSONB, -- Full list: {"shopify": "v2.1", "stripe": "v3"}
  missing_technologies JSONB,  -- What they should have: ["google_analytics", "ssl"]
  
  -- Quality Metrics
  signal_strength INTEGER, -- 0-100 score based on # of signals detected
  last_scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexing for fast API queries
  INDEX idx_shopify (has_shopify),
  INDEX idx_stripe (has_stripe),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_signal_strength (signal_strength DESC)
);
```

### `api_usage` (Metered Billing Tracking)
```sql
CREATE TABLE api_usage (
  id BIGSERIAL PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL, -- Stripe customer ID
  records_pulled INTEGER NOT NULL,
  query_params JSONB, -- {"tech": "shopify", "missing": "pixel"}
  pulled_at TIMESTAMP DEFAULT NOW(),
  stripe_usage_record_id VARCHAR(255), -- For idempotency
  
  INDEX idx_customer_pulled_at (customer_id, pulled_at DESC)
);
```

### `api_keys` (Authentication)
```sql
CREATE TABLE api_keys (
  id BIGSERIAL PRIMARY KEY,
  key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of Bearer token
  customer_id VARCHAR(255) NOT NULL, -- Stripe customer ID
  stripe_subscription_id VARCHAR(255), -- For metered billing
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  
  INDEX idx_key_hash (key_hash)
);
```

## Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE tech_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (API endpoint uses service role)
CREATE POLICY "Service role full access" ON tech_signals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON api_usage
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');
```

## High-Value Tech Signals to Detect

### E-commerce Stack
1. **Shopify** - `Shopify.shop`, `cdn.shopify.com`, `myshopify.com`
2. **WooCommerce** - `woocommerce`, `wp-content/plugins/woocommerce`
3. **Stripe** - `js.stripe.com`, `Stripe(`, `stripe.com/v3`

### Marketing Tools
4. **Klaviyo** - `klaviyo.com/media/js`, `_learnq.push`
5. **Facebook Pixel** - `fbq(`, `connect.facebook.net/en_US/fbevents.js`
6. **Google Analytics** - `google-analytics.com/analytics.js`, `gtag(`, `UA-`

### Development/API
7. **OpenAI API** - `api.openai.com`, `openai.com/v1`
8. **WordPress** - `wp-content`, `wp-includes`, `WordPress`

### Security/Infrastructure
9. **Broken SSL** - Check if HTTPS fails or cert expired
10. **Missing Analytics** - No GA, no Pixel, no tracking = opportunity

## API Query Examples

```javascript
// Find Shopify stores without Facebook Pixel
GET /api/v1/stream?tech=shopify&missing=facebook_pixel&limit=50

// Find sites with broken SSL
GET /api/v1/stream?broken_ssl=true&limit=100

// Find WordPress sites using Stripe
GET /api/v1/stream?tech=wordpress,stripe&limit=25
```

## Pricing Model

- **Base**: $0.05 per record pulled
- **Stripe Metered Billing**: Report usage after each API call
- **Billing Cycle**: Monthly invoice based on total records pulled
- **Free Tier**: First 100 records/month free (to encourage trial)

## Data Freshness Strategy

- **Daily Scrape**: 10,000 new domains per day
- **Re-scrape**: Every 30 days for existing domains (tech stacks change)
- **Priority Queue**: Re-scrape high-signal-strength domains more frequently
