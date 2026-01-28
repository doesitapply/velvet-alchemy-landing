/**
 * Technographic Hunter API Endpoint
 * 
 * This is a Next.js App Router API route.
 * Deploy location: app/api/v1/leads/route.ts
 * 
 * Usage:
 * curl -H "Authorization: Bearer sk_test_123" \
 *   "https://your-domain.com/api/v1/leads?tech=shopify&pixel=false&limit=10"
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase (Use Service Role Key to bypass RLS for the API)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple Hardcoded Keys for MVP (Replace with a DB check later)
const VALID_KEYS = new Set([
  "sk_test_123",  // You use this for testing
  "client_alpha"  // Your first paying customer
]);

export async function GET(req: NextRequest) {
  // 1. Security Gate: Check API Key
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');

  if (!apiKey || !VALID_KEYS.has(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse Query Parameters (The "Filters" your customers pay for)
  const { searchParams } = new URL(req.url);
  const tech = searchParams.get('tech');        // e.g., "shopify"
  const pixel = searchParams.get('pixel');      // e.g., "false" (Find leads MISSING pixel)
  const ga4 = searchParams.get('ga4');          // e.g., "false" (Find leads MISSING ga4)
  const gtm = searchParams.get('gtm');          // e.g., "false" (Find leads MISSING gtm)
  const limit = parseInt(searchParams.get('limit') || '10');

  // 3. Query the "Inventory" (Supabase)
  let query = supabase
    .from('technographic_leads')
    .select('url, detected_cms, has_pixel, has_ga4, has_gtm, ssl_error, neglected, last_scanned_at');

  // Apply filters dynamically
  if (tech) {
    query = query.eq('detected_cms', tech);
  }
  if (pixel === 'false') {
    query = query.eq('has_pixel', false); // The "Money" Filter
  }
  if (ga4 === 'false') {
    query = query.eq('has_ga4', false);
  }
  if (gtm === 'false') {
    query = query.eq('has_gtm', false);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 4. Return the Goods
  return NextResponse.json({
    meta: {
      count: data.length,
      filters: { tech, pixel, ga4, gtm },
      pricing: {
        per_record: 0.05,
        total_cost: (data.length * 0.05).toFixed(2)
      }
    },
    data: data
  });
}

/**
 * Example Queries:
 * 
 * 1. Get Shopify stores missing analytics:
 *    GET /api/v1/leads?tech=shopify&pixel=false&ga4=false&gtm=false
 * 
 * 2. Get all Shopify stores:
 *    GET /api/v1/leads?tech=shopify&limit=100
 * 
 * 3. Get stores with SSL errors:
 *    GET /api/v1/leads?ssl_error=true
 */
