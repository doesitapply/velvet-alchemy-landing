/**
 * Setup Stripe Products
 * Creates products and prices for Velvet Alchemy services
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

async function setupProducts() {
  console.log("🚀 Creating Stripe products...\n");

  try {
    // Product 1: Website Audit Report
    const auditProduct = await stripe.products.create({
      name: "Website Audit Report",
      description: "Comprehensive AI-powered visual audit of your website with prestige scoring, visual debt analysis, and actionable recommendations. Delivered in 24 hours.",
      images: ["https://velvet-alchemy.manus.space/images/audit-preview.png"],
      metadata: {
        category: "audit",
        deliveryTime: "24h",
      },
    });

    const auditPrice = await stripe.prices.create({
      product: auditProduct.id,
      unit_amount: 9700, // $97
      currency: "usd",
      nickname: "One-Time Audit",
    });

    console.log("✅ Created: Website Audit Report ($97)");
    console.log(`   Product ID: ${auditProduct.id}`);
    console.log(`   Price ID: ${auditPrice.id}\n`);

    // Product 2: Website Redesign - Basic
    const redesignBasicProduct = await stripe.products.create({
      name: "Website Redesign - Basic",
      description: "Landing page redesign with modern UI, mobile optimization, and basic SEO. Perfect for small businesses getting started.",
      metadata: {
        category: "redesign",
        tier: "basic",
        pages: "1",
      },
    });

    const redesignBasicPrice = await stripe.prices.create({
      product: redesignBasicProduct.id,
      unit_amount: 49700, // $497
      currency: "usd",
      nickname: "Basic Package",
    });

    console.log("✅ Created: Website Redesign - Basic ($497)");
    console.log(`   Product ID: ${redesignBasicProduct.id}`);
    console.log(`   Price ID: ${redesignBasicPrice.id}\n`);

    // Product 3: Website Redesign - Pro
    const redesignProProduct = await stripe.products.create({
      name: "Website Redesign - Pro",
      description: "Full website redesign (up to 5 pages) with custom branding, advanced SEO, and 3 months of support. Ideal for growing businesses.",
      metadata: {
        category: "redesign",
        tier: "pro",
        pages: "5",
        support: "3 months",
      },
    });

    const redesignProPrice = await stripe.prices.create({
      product: redesignProProduct.id,
      unit_amount: 149700, // $1,497
      currency: "usd",
      nickname: "Pro Package",
    });

    console.log("✅ Created: Website Redesign - Pro ($1,497)");
    console.log(`   Product ID: ${redesignProProduct.id}`);
    console.log(`   Price ID: ${redesignProPrice.id}\n`);

    // Product 4: Website Redesign - Premium
    const redesignPremiumProduct = await stripe.products.create({
      name: "Website Redesign - Premium",
      description: "Complete digital transformation with unlimited pages, custom functionality, ongoing SEO optimization, and 12 months of priority support.",
      metadata: {
        category: "redesign",
        tier: "premium",
        pages: "unlimited",
        support: "12 months",
      },
    });

    const redesignPremiumPrice = await stripe.prices.create({
      product: redesignPremiumProduct.id,
      unit_amount: 349700, // $3,497
      currency: "usd",
      nickname: "Premium Package",
    });

    console.log("✅ Created: Website Redesign - Premium ($3,497)");
    console.log(`   Product ID: ${redesignPremiumProduct.id}`);
    console.log(`   Price ID: ${redesignPremiumPrice.id}\n`);

    // Product 5: SEO & Ranking Service (Monthly Subscription)
    const seoProduct = await stripe.products.create({
      name: "SEO & Ranking Service",
      description: "Monthly SEO optimization and ranking monitoring. Track your Google position, get keyword recommendations, and monthly progress reports.",
      metadata: {
        category: "subscription",
        type: "seo",
      },
    });

    const seoPrice = await stripe.prices.create({
      product: seoProduct.id,
      unit_amount: 29700, // $297/month
      currency: "usd",
      recurring: {
        interval: "month",
      },
      nickname: "Monthly SEO",
    });

    console.log("✅ Created: SEO & Ranking Service ($297/month)");
    console.log(`   Product ID: ${seoProduct.id}`);
    console.log(`   Price ID: ${seoPrice.id}\n`);

    // Product 6: Marketing Assets Pack
    const assetsProduct = await stripe.products.create({
      name: "Marketing Assets Pack",
      description: "AI-generated social media posts (3x) and web banner (1x) based on your brand DNA. Perfect for businesses that need fresh content fast.",
      metadata: {
        category: "assets",
        quantity: "4",
      },
    });

    const assetsPrice = await stripe.prices.create({
      product: assetsProduct.id,
      unit_amount: 7700, // $77
      currency: "usd",
      nickname: "Assets Pack",
    });

    console.log("✅ Created: Marketing Assets Pack ($77)");
    console.log(`   Product ID: ${assetsProduct.id}`);
    console.log(`   Price ID: ${assetsPrice.id}\n`);

    console.log("🎉 All products created successfully!");
    console.log("\n📋 Summary:");
    console.log("- Website Audit Report: $97");
    console.log("- Website Redesign - Basic: $497");
    console.log("- Website Redesign - Pro: $1,497");
    console.log("- Website Redesign - Premium: $3,497");
    console.log("- SEO & Ranking Service: $297/month");
    console.log("- Marketing Assets Pack: $77");
  } catch (error: any) {
    console.error("❌ Error creating products:", error.message);
    throw error;
  }
}

setupProducts();
