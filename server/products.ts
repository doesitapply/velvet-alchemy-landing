/**
 * Stripe Product Definitions
 * 
 * Define all website packages here for consistent pricing across the application.
 */

export const WEBSITE_PACKAGES = {
  basic: {
    name: 'Basic Website',
    description: 'Single-page website, mobile-responsive, contact form',
    price: 3000, // in cents ($30.00)
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
    price: 5000, // in cents ($50.00)
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
    price: 8000, // in cents ($80.00)
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
