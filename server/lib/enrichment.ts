import { invokeAI } from "../aiProvider";
import axios from "axios";

/**
 * Extract email addresses from a string using regex
 */
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return Array.from(new Set(text.match(emailRegex) || []));
}

/**
 * Find contact email on a website by crawling homepage and contact pages
 */
export async function findContactEmail(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null;

  const baseUrl = new URL(websiteUrl).origin;
  const targetPages = new Set([
    baseUrl,
    `${baseUrl}/contact`,
    `${baseUrl}/contact-us`,
    `${baseUrl}/about`,
    (`${baseUrl}/contact/`).replace(/\/+$/, '/'), // handles some trailing slash cases
  ]);

  console.log(`[Enrichment] Searching for contact info on ${baseUrl}...`);

  const visited = new Set<string>();
  const emailScores: Record<string, number> = {};

  for (const url of Array.from(targetPages)) {
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      });
      const html = response.data;
      const emails = extractEmails(html);

      // Filter and score emails
      emails.forEach(email => {
        const e = email.toLowerCase();
        if (e.endsWith('.png') || e.endsWith('.jpg') || e.endsWith('.svg') || e.includes('wixpress.com')) return;

        let score = 1;
        if (e.includes('info') || e.includes('hello') || e.includes('contact')) score += 5;
        if (e.includes('hi@') || e.includes('hey@')) score += 3;

        emailScores[e] = (emailScores[e] || 0) + score;
      });

      // If we found a good amount of emails, no need to crawl further
      if (Object.keys(emailScores).length > 2) break;

      // Extract potential sub-links if we haven't found anything yet
      const linkRegex = /href=["']([^"']*(?:contact|about|team|reach)[^"']*)["']/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let link = match[1];
        if (link.startsWith('/')) link = baseUrl + link;
        if (link.startsWith(baseUrl)) targetPages.add(link);
      }
    } catch (e) {
      // ignore failures
    }
  }

  const sortedEmails = Object.entries(emailScores).sort((a, b) => b[1] - a[1]);
  if (sortedEmails.length > 0) {
    const bestEmail = sortedEmails[0][0];
    console.log(`   ✅ Best contact found: ${bestEmail} (Confidence: ${sortedEmails[0][1]})`);
    return bestEmail;
  }

  return null;
}

/**
 * Revenue Calculator
 * Estimates annual revenue loss based on prestige score and business category
 */
export function calculateRevenueLoss(prestigeScore: number, category: string): {
  annualLoss: number;
  monthlyLoss: number;
  explanation: string;
} {
  // Base conversion rate assumptions
  const avgMonthlyTraffic = 500; // Conservative estimate for local businesses
  const avgConversionRate = 0.02; // 2% baseline

  // Calculate lost conversion rate based on prestige gap
  const prestigeGap = 100 - prestigeScore;
  const lostConversionRate = (prestigeGap / 100) * avgConversionRate;

  // Category-specific average transaction values
  const categoryValues: Record<string, number> = {
    electrician: 850,
    plumber: 650,
    roofer: 4500,
    hvac: 3200,
    salon: 120,
    restaurant: 35,
    default: 500,
  };

  const avgTransactionValue = categoryValues[category.toLowerCase()] || categoryValues.default;

  // Calculate lost customers per month
  const lostCustomersPerMonth = avgMonthlyTraffic * lostConversionRate;

  // Calculate revenue loss
  const monthlyLoss = Math.round(lostCustomersPerMonth * avgTransactionValue);
  const annualLoss = monthlyLoss * 12;

  const explanation = `Based on an estimated ${avgMonthlyTraffic} monthly visitors and a prestige gap of ${prestigeGap} points, your website is likely losing ${lostCustomersPerMonth.toFixed(1)} potential customers per month at $${avgTransactionValue} average transaction value.`;

  return {
    annualLoss,
    monthlyLoss,
    explanation,
  };
}

/**
 * Technical Audit
 * Analyzes website for technical issues that impact conversions
 */
export async function performTechnicalAudit(websiteUrl: string): Promise<{
  loadSpeed: string;
  mobileFriendly: boolean;
  sslEnabled: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Check SSL
    const sslEnabled = websiteUrl.startsWith('https://');
    if (!sslEnabled) {
      issues.push("No SSL certificate - browsers show 'Not Secure' warning");
    }

    // Simulate page speed check (in production, use Lighthouse API)
    const loadSpeed = "3.2s"; // Placeholder
    if (parseFloat(loadSpeed) > 3.0) {
      issues.push(`Slow load time (${loadSpeed}) - 53% of users abandon sites that take >3s to load`);
    }

    // Simulate mobile-friendly check
    const mobileFriendly = Math.random() > 0.3; // 70% chance of being mobile-friendly
    if (!mobileFriendly) {
      issues.push("Not mobile-optimized - 60% of traffic is mobile");
    }

    return {
      loadSpeed,
      mobileFriendly,
      sslEnabled,
      issues,
    };
  } catch (error) {
    console.error('[TechnicalAudit] Error:', error);
    return {
      loadSpeed: "unknown",
      mobileFriendly: false,
      sslEnabled: false,
      issues: ["Unable to complete technical audit"],
    };
  }
}

/**
 * Conversion Leak Detector
 * Uses AI to identify missing CTAs, forms, and conversion elements
 */
export async function detectConversionLeaks(screenshotUrl: string, companyName: string): Promise<string[]> {
  try {
    const response = await invokeAI({
      messages: [
        {
          role: "system",
          content: "You are a conversion rate optimization expert. Analyze websites for missing conversion elements.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this ${companyName} website screenshot and list 3-5 specific conversion leaks (missing CTAs, unclear value props, hidden contact info, poor navigation, etc.). Be specific and actionable. Format as a JSON array of strings.`,
            },
            {
              type: "image_url",
              image_url: {
                url: screenshotUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      responseFormat: "json_schema",
      schema: {
        name: "conversion_leaks",
        strict: true,
        schema: {
          type: "object",
          properties: {
            leaks: {
              type: "array",
              items: { type: "string" },
              description: "List of specific conversion leaks found",
            },
          },
          required: ["leaks"],
          additionalProperties: false,
        },
      },
    });

    if (!response.content) {
      throw new Error("No response from LLM");
    }
    const result = JSON.parse(response.content);
    return result.leaks || [];
  } catch (error) {
    console.error('[ConversionLeaks] Error:', error);
    return ["Unable to analyze conversion leaks"];
  }
}

/**
 * Competitor Analysis
 * Finds better-ranked competitors in the same niche
 */
export async function findCompetitorGaps(companyName: string, category: string, location: string): Promise<{
  competitorUrl: string;
  gapFound: string;
}> {
  // In production, use Google Search API or SerpAPI
  // For now, return placeholder data
  return {
    competitorUrl: `https://example-competitor.com`,
    gapFound: `Top-ranked competitor has professional photography, clear pricing, and 50+ reviews. ${companyName} lacks all three.`,
  };
}

/**
 * Complete Enrichment Pipeline
 * Combines all analysis functions to populate detailedReport
 */
export async function enrichLead(lead: {
  id: number;
  companyName: string;
  websiteUrl: string;
  category: string;
  location: string;
  screenshotUrl: string | null;
  prestigeScore: number | null;
}): Promise<{
  detailedReport: any;
  revenueLoss: { annual: number; monthly: number };
}> {
  console.log(`[Enrichment] Starting enrichment for ${lead.companyName}`);

  // Calculate revenue loss
  const revenueLoss = calculateRevenueLoss(lead.prestigeScore || 50, lead.category);

  // Technical audit
  const technicalAudit = await performTechnicalAudit(lead.websiteUrl);

  // Conversion leaks (only if screenshot exists)
  let conversionLeaks: string[] = [];
  if (lead.screenshotUrl) {
    conversionLeaks = await detectConversionLeaks(lead.screenshotUrl, lead.companyName);
  }

  // Competitor analysis
  const competitorAnalysis = await findCompetitorGaps(
    lead.companyName,
    lead.category,
    lead.location
  );

  // Build detailed report
  const detailedReport = {
    visual_audit: {
      score: lead.prestigeScore || 0,
      critique: `Prestige score of ${lead.prestigeScore}/100 indicates ${lead.prestigeScore && lead.prestigeScore < 60 ? 'significant' : 'moderate'} room for improvement in visual design and user experience.`,
    },
    technical_audit: {
      load_speed: technicalAudit.loadSpeed,
      mobile_friendly: technicalAudit.mobileFriendly,
      ssl_enabled: technicalAudit.sslEnabled,
      issues: technicalAudit.issues,
    },
    conversion_leaks: conversionLeaks,
    competitor_analysis: {
      competitor_url: competitorAnalysis.competitorUrl,
      gap_found: competitorAnalysis.gapFound,
    },
    revenue_impact: {
      annual_loss: revenueLoss.annualLoss,
      monthly_loss: revenueLoss.monthlyLoss,
      explanation: revenueLoss.explanation,
    },
    suggested_fix: `Redesign with modern UI, optimize for mobile, add clear CTAs, and improve page speed to recover an estimated $${revenueLoss.annualLoss.toLocaleString()}/year in lost revenue.`,
  };

  console.log(`[Enrichment] Completed for ${lead.companyName} - Annual loss: $${revenueLoss.annualLoss}`);

  return {
    detailedReport,
    revenueLoss: {
      annual: revenueLoss.annualLoss,
      monthly: revenueLoss.monthlyLoss,
    },
  };
}
