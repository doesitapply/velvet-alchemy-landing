/**
 * Stripe Products Configuration
 * 
 * Product and price IDs for Velvet Alchemy services
 * Generated on: 2026-01-29
 */

export const PRODUCTS = {
  // 1. MONITORING (RETAINER)
  SENTRY: {
    productId: "prod_sentry_v1",
    priceId: "price_sentry_v1",
    name: "Revenue Sentry",
    price: 29900, // $299/mo
    currency: "usd",
    recurring: true,
    interval: "month",
    description: "24/7 Infrastructure monitoring and weekly silent failure reports. Your insurance policy against technical debt.",
    features: [
      "24/7 Infrastructure Scan",
      "Broken Link & Pixel Monitor",
      "Weekly 'Silent Failure' Report",
      "Local Reno SEO Status Check",
      "Meta/Google Tag Verification"
    ],
  },

  // 2. THE BUILD (ONE-TIME)
  ARCHITECT: {
    productId: "prod_architect_v1",
    priceId: "price_architect_v1",
    name: "Yield Architect",
    price: 350000, // $3,500 One-Time
    currency: "usd",
    recurring: false, // One-time project
    description: "Complete visual debt removal and high-conversion landing page build. We fix the machine once, correctly.",
    features: [
      "Full Visual Debt Removal",
      "High-Conversion Landing Page Build",
      "Copywriting & Asset Genesis",
      "GA4 & Tracking Instrumentation",
      "OWNERSHIP: No Monthly Rent"
    ],
  },

  // 3. THE PARTNER (RETAINER)
  ALCHEMIST: {
    productId: "prod_alchemist_v1",
    priceId: "price_alchemist_v1",
    name: "Revenue Alchemist",
    price: 550000, // $5,500/mo
    currency: "usd",
    recurring: true,
    interval: "month",
    description: "Fractional Chief Growth Officer. Active aggression, strategy, and unlimited iterations.",
    features: [
      "Everything in Sentry",
      "Unlimited Landing Page Iterations",
      "Active Ad Management & Rotation",
      "Weekly Strategy Sync",
      "Priority Access to Cameron"
    ],
  },

  // LEGACY / ADD-ONS
  AUDIT: {
    productId: "prod_TshF0V3EKGTIRJ",
    priceId: "price_1Suvr6BivdKg5sw50QbA3Awo",
    name: "Website Audit Report",
    price: 9700, // $97
    currency: "usd",
    description: "Comprehensive AI-powered visual audit.",
    features: ["AI-powered analysis", "Prestige score", "24-hour delivery"],
  },
  ASSETS_PACK: {
    productId: "prod_TshFaVHUCg64Dy",
    priceId: "price_1SuvrEBivdKg5sw5KWQOmabn",
    name: "Marketing Assets Pack",
    price: 7700, // $77
    currency: "usd",
    description: "AI-generated social media posts and web banner.",
    features: ["3x social posts", "1x web banner", "Fast delivery"],
  },
} as const;

/**
 * Helper to format price for display
 */
export function formatPrice(cents: number, currency: string = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Get product by ID
 */
export function getProductById(productId: string) {
  return Object.values(PRODUCTS).find((p) => p.productId === productId);
}

/**
 * Get product by price ID
 */
export function getProductByPriceId(priceId: string) {
  return Object.values(PRODUCTS).find((p) => p.priceId === priceId);
}

// Legacy exports for backward compatibility
export const WEBSITE_PACKAGES = {
  basic: PRODUCTS.SENTRY,
  standard: PRODUCTS.ARCHITECT,
  premium: PRODUCTS.ALCHEMIST,
} as const;

export type PackageType = keyof typeof WEBSITE_PACKAGES;
