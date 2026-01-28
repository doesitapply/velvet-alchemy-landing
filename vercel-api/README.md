# Technographic Hunter API

Production-ready Next.js API for selling Shopify store data via REST endpoint.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create `.env.local`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Test Locally
```bash
npm run dev
```

Test the endpoint:
```bash
curl -H "Authorization: Bearer sk_test_123" \
  "http://localhost:3000/api/v1/leads?tech=shopify&pixel=false"
```

### 4. Deploy to Vercel
```bash
./deploy.sh
```

Or manually:
```bash
npx vercel login
npx vercel
npx vercel env add SUPABASE_URL
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel --prod
```

## API Documentation

### Endpoint
```
GET /api/v1/leads
```

### Authentication
Bearer token in `Authorization` header:
```
Authorization: Bearer sk_test_123
```

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `tech` | string | Filter by CMS/platform | `shopify` |
| `pixel` | string | Filter by Meta Pixel presence | `false` |
| `ga4` | string | Filter by GA4 presence | `false` |
| `gtm` | string | Filter by GTM presence | `false` |
| `limit` | integer | Max results to return | `10` |

### Example Queries

**Get Shopify stores missing all analytics:**
```bash
curl -H "Authorization: Bearer sk_test_123" \
  "https://your-api.vercel.app/api/v1/leads?tech=shopify&pixel=false&ga4=false&gtm=false"
```

**Get all Shopify stores:**
```bash
curl -H "Authorization: Bearer sk_test_123" \
  "https://your-api.vercel.app/api/v1/leads?tech=shopify&limit=100"
```

### Response Format
```json
{
  "meta": {
    "count": 3,
    "filters": {
      "tech": "shopify",
      "pixel": "false",
      "ga4": "false",
      "gtm": "false"
    },
    "pricing": {
      "per_record": 0.05,
      "total_cost": "0.15"
    }
  },
  "data": [
    {
      "url": "https://gymshark.com",
      "detected_cms": "shopify",
      "has_pixel": false,
      "has_ga4": false,
      "has_gtm": false,
      "ssl_error": false,
      "neglected": false,
      "last_scanned_at": "2026-01-27T20:00:00Z"
    }
  ]
}
```

## Project Structure

```
vercel-api/
├── app/
│   └── api/
│       └── v1/
│           └── leads/
│               └── route.ts    # API endpoint
├── package.json
├── tsconfig.json
├── next.config.js
├── deploy.sh                   # Deployment script
└── README.md
```

## Adding New API Keys

Edit `app/api/v1/leads/route.ts`:
```typescript
const VALID_KEYS = new Set([
  "sk_test_123",
  "client_alpha",
  "client_beta"  // Add new key here
]);
```

## Pricing Model

- **MVP:** $99/month for 2000 records (5¢ each)
- **Scale:** Usage-based billing via Stripe ($0.05/record)

## Next Steps

1. ✅ Deploy API to Vercel
2. 🔄 Integrate Stripe metered billing
3. 🎨 Build landing page
4. 📊 Add usage analytics
5. 🚀 Launch and market

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Supabase Docs: https://supabase.com/docs
