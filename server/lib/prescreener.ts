/**
 * Pre-screening system for lead prioritization
 * Performs lightweight technical checks to score leads 0-100 without full GPT-4o audit
 */

import https from "https";
import http from "http";

export interface PreScreenResult {
  priorityScore: number;
  checks: {
    hasSSL: boolean;
    domainAge: number | null; // days since registration
    pageLoadSpeed: number | null; // milliseconds
    mobileResponsive: boolean | null;
    hasContactInfo: boolean | null;
    businessCategory: string;
  };
  reasoning: string;
}

/**
 * Pre-screen a lead to determine priority score (0-100)
 * Higher score = higher priority for full audit
 */
export async function prescreenLead(
  websiteUrl: string,
  businessCategory: string = "general"
): Promise<PreScreenResult> {
  const checks = {
    hasSSL: false,
    domainAge: null as number | null,
    pageLoadSpeed: null as number | null,
    mobileResponsive: null as boolean | null,
    hasContactInfo: null as boolean | null,
    businessCategory,
  };

  try {
    // Check 1: SSL/HTTPS (10 points)
    checks.hasSSL = websiteUrl.startsWith("https://");

    // Check 2: Page load speed (20 points max)
    const loadStart = Date.now();
    await checkPageLoad(websiteUrl);
    checks.pageLoadSpeed = Date.now() - loadStart;

    // Check 3: Basic mobile responsiveness check (15 points)
    // For now, just check if site loads - could expand with viewport meta tag check
    checks.mobileResponsive = checks.pageLoadSpeed !== null;

    // Check 4: Business category value multiplier (30 points)
    // High-value categories: contractors, medical, legal, restaurants
    // Medium: retail, services
    // Low: generic

    // Check 5: Domain age estimation (25 points)
    // We can't easily check WHOIS without external API, so we'll estimate based on other factors
    // For now, assume all domains are mature enough (this could be enhanced later)
    checks.domainAge = 365; // Placeholder - assume 1 year old
  } catch (error) {
    console.error("[Prescreener] Error checking website:", error);
  }

  // Calculate priority score
  let score = 0;
  let reasoning = "";

  // SSL check (10 points)
  if (checks.hasSSL) {
    score += 10;
    reasoning += "✓ Has SSL certificate (+10). ";
  } else {
    reasoning += "✗ No SSL certificate (0). ";
  }

  // Page load speed (20 points max)
  if (checks.pageLoadSpeed !== null) {
    if (checks.pageLoadSpeed < 2000) {
      score += 20;
      reasoning += `✓ Fast load time ${checks.pageLoadSpeed}ms (+20). `;
    } else if (checks.pageLoadSpeed < 5000) {
      score += 10;
      reasoning += `~ Moderate load time ${checks.pageLoadSpeed}ms (+10). `;
    } else {
      score += 5;
      reasoning += `✗ Slow load time ${checks.pageLoadSpeed}ms (+5). `;
    }
  }

  // Mobile responsive (15 points)
  if (checks.mobileResponsive) {
    score += 15;
    reasoning += "✓ Site loads successfully (+15). ";
  }

  // Business category value (30 points)
  const categoryScores: Record<string, number> = {
    roofing: 30,
    plumbing: 30,
    electrician: 30,
    contractor: 30,
    hvac: 30,
    medical: 28,
    dental: 28,
    legal: 28,
    restaurant: 25,
    pizza: 25,
    retail: 20,
    services: 20,
    general: 15,
  };

  const categoryKey = businessCategory.toLowerCase();
  const categoryScore =
    categoryScores[categoryKey] || categoryScores["general"];
  score += categoryScore;
  reasoning += `✓ ${businessCategory} category (+${categoryScore}). `;

  // Domain age bonus (25 points max)
  // Since we can't easily check WHOIS, give a moderate score
  score += 15;
  reasoning += "~ Assumed established domain (+15). ";

  // Cap at 100
  score = Math.min(100, score);

  return {
    priorityScore: score,
    checks,
    reasoning: reasoning.trim(),
  };
}

/**
 * Simple HTTP/HTTPS check to see if page loads
 */
function checkPageLoad(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const timeout = 10000; // 10 second timeout

    const req = protocol.get(
      url,
      {
        timeout,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VelvetAlchemy/1.0; +https://velvetalchemy.com)",
        },
      },
      (res) => {
        // Accept any 2xx or 3xx status
        if (res.statusCode && res.statusCode < 400) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
        // Abort request - we don't need the body
        res.destroy();
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}
