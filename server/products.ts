/**
 * Stripe Product Definitions
 *
 * Prices are in cents (USD). Stripe requires integer cents.
 * $3,000 = 300000 cents | $5,000 = 500000 cents | $8,000 = 800000 cents
 */

export const WEBSITE_PACKAGES = {
  basic: {
    name: 'Basic Website',
    description: 'Single-page website, mobile-responsive, contact form',
    price: 300000, // $3,000.00 in cents
    currency: 'usd',
    features: [
      'Single-page design',
      'Mobile-responsive',
      'Contact form',
      'Google Maps integration',
      '7-day delivery',
    ],
  },
  standard: {
    name: 'Standard Website',
    description: 'Multi-page website with SEO optimization and Google Maps',
    price: 500000, // $5,000.00 in cents
    currency: 'usd',
    features: [
      'Multi-page design (Home, Services, About, Contact)',
      'Mobile-responsive',
      'Contact form',
      'Google Maps integration',
      'SEO optimization',
      '10-day delivery',
      '30 days of free revisions',
    ],
  },
  premium: {
    name: 'Premium Website',
    description: 'Complete website with blog, social media integration, and 3 months of updates',
    price: 800000, // $8,000.00 in cents
    currency: 'usd',
    features: [
      'Everything in Standard',
      'Blog setup',
      'Social media integration',
      'Advanced SEO',
      '14-day delivery',
      '3 months of free updates',
    ],
  },
} as const;

export type PackageType = keyof typeof WEBSITE_PACKAGES;
