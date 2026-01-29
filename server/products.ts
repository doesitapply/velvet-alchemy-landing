/**
 * Stripe Products Configuration
 * 
 * Product and price IDs for Velvet Alchemy services
 * Generated on: 2026-01-29
 */

export const PRODUCTS = {
  AUDIT: {
    productId: "prod_TshF0V3EKGTIRJ",
    priceId: "price_1Suvr6BivdKg5sw50QbA3Awo",
    name: "Website Audit Report",
    price: 9700, // $97
    currency: "usd",
    description: "Comprehensive AI-powered visual audit of your website with prestige scoring, visual debt analysis, and actionable recommendations. Delivered in 24 hours.",
    features: [
      "AI-powered visual analysis",
      "Prestige score (0-100)",
      "Visual debt breakdown",
      "Actionable recommendations",
      "24-hour delivery",
    ],
  },

  REDESIGN_BASIC: {
    productId: "prod_TshFVBapnf3JHF",
    priceId: "price_1Suvr8BivdKg5sw5jfAjuHGh",
    name: "Website Redesign - Basic",
    price: 49700, // $497
    currency: "usd",
    description: "Landing page redesign with modern UI, mobile optimization, and basic SEO. Perfect for small businesses getting started.",
    features: [
      "1 landing page redesign",
      "Modern, mobile-first UI",
      "Basic SEO optimization",
      "Fast load times",
      "1 month support",
    ],
  },

  REDESIGN_PRO: {
    productId: "prod_TshFmCz0X19ZmJ",
    priceId: "price_1SuvrABivdKg5sw5bAkSW6wT",
    name: "Website Redesign - Pro",
    price: 149700, // $1,497
    currency: "usd",
    description: "Full website redesign (up to 5 pages) with custom branding, advanced SEO, and 3 months of support. Ideal for growing businesses.",
    features: [
      "Up to 5 pages",
      "Custom branding & design",
      "Advanced SEO optimization",
      "Contact forms & CTAs",
      "3 months support",
    ],
  },

  REDESIGN_PREMIUM: {
    productId: "prod_TshFzfZ2jc21Bv",
    priceId: "price_1SuvrBBivdKg5sw5OBZ5KIRa",
    name: "Website Redesign - Premium",
    price: 349700, // $3,497
    currency: "usd",
    description: "Complete digital transformation with unlimited pages, custom functionality, ongoing SEO optimization, and 12 months of priority support.",
    features: [
      "Unlimited pages",
      "Custom functionality",
      "Ongoing SEO optimization",
      "Priority support (12 months)",
      "Monthly performance reports",
    ],
  },

  SEO_MONTHLY: {
    productId: "prod_TshFRHGfRhKweG",
    priceId: "price_1SuvrCBivdKg5sw5ek0wFLgh",
    name: "SEO & Ranking Service",
    price: 29700, // $297/month
    currency: "usd",
    recurring: true,
    interval: "month",
    description: "Monthly SEO optimization and ranking monitoring. Track your Google position, get keyword recommendations, and monthly progress reports.",
    features: [
      "Google ranking tracking",
      "Keyword recommendations",
      "Monthly progress reports",
      "Competitor analysis",
      "Ongoing optimization",
    ],
  },

  ASSETS_PACK: {
    productId: "prod_TshFaVHUCg64Dy",
    priceId: "price_1SuvrEBivdKg5sw5KWQOmabn",
    name: "Marketing Assets Pack",
    price: 7700, // $77
    currency: "usd",
    description: "AI-generated social media posts (3x) and web banner (1x) based on your brand DNA. Perfect for businesses that need fresh content fast.",
    features: [
      "3x social media posts",
      "1x web banner",
      "AI-generated from brand DNA",
      "High-resolution files",
      "24-hour delivery",
    ],
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
  basic: PRODUCTS.REDESIGN_BASIC,
  standard: PRODUCTS.REDESIGN_PRO,
  premium: PRODUCTS.REDESIGN_PREMIUM,
} as const;

export type PackageType = keyof typeof WEBSITE_PACKAGES;
