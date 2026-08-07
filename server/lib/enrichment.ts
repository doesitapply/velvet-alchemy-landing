import { invokeLLM } from "../_core/llm";
import {
  findVerifiedOwnerEmail,
  type EnrichedContact,
} from "./emailEnrichment";

export function buildNotMeasuredRevenueImpact(): {
  status: "not_measured";
  annualLoss: null;
  monthlyLoss: null;
  explanation: string;
} {
  return {
    status: "not_measured",
    annualLoss: null,
    monthlyLoss: null,
    explanation:
      "Velvet did not measure customer loss or revenue impact. Modeled loss is excluded from prospect evidence and outreach.",
  };
}

/**
 * Technical Audit
 * Analyzes website for technical issues that impact conversions
 */
export async function performTechnicalAudit(websiteUrl: string): Promise<{
  loadSpeed: null;
  mobileFriendly: null;
  httpsUrl: boolean;
  sslEnabled: null;
  measurementStatus: "not_measured";
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const url = new URL(websiteUrl);
    const httpsUrl = url.protocol === "https:";
    if (!httpsUrl) {
      issues.push(
        "The recorded public website URL uses HTTP rather than HTTPS. Certificate behavior was not independently tested."
      );
    }

    return {
      loadSpeed: null,
      mobileFriendly: null,
      httpsUrl,
      sslEnabled: null,
      measurementStatus: "not_measured",
      issues,
    };
  } catch (error) {
    console.error("[TechnicalAudit] Error:", error);
    return {
      loadSpeed: null,
      mobileFriendly: null,
      httpsUrl: false,
      sslEnabled: null,
      measurementStatus: "not_measured",
      issues: ["The recorded website URL could not be parsed for review."],
    };
  }
}

/**
 * Conversion Leak Detector
 * Uses AI to identify missing CTAs, forms, and conversion elements
 */
export async function detectConversionLeaks(
  screenshotUrl: string,
  companyName: string
): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You review website screenshots. Describe only visible interface details. Use cautious language such as 'appears' or 'may create friction'. Never claim a screenshot proves lost revenue, lost customers, ranking impact, page speed, mobile compatibility, or conversion impact.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Review this ${companyName} website screenshot and list up to five visible interface observations that may create contact or booking friction, such as a hard-to-find CTA, unclear service description, hidden contact path, or confusing navigation. Do not infer anything that is not visible in the screenshot. Format as a JSON array of strings.`,
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
      response_format: {
        type: "json_schema",
        json_schema: {
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
      },
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(
      typeof content === "string" ? content : JSON.stringify(content)
    );
    return result.leaks || [];
  } catch (error) {
    console.error("[ConversionLeaks] Error:", error);
    return [];
  }
}

/**
 * Competitor Analysis
 * Finds better-ranked competitors in the same niche
 */
export async function findCompetitorGaps(
  companyName: string,
  category: string,
  location: string
): Promise<{
  status: "not_measured";
  competitorUrl: null;
  gapFound: null;
}> {
  void companyName;
  void category;
  void location;
  return {
    status: "not_measured",
    competitorUrl: null,
    gapFound: null,
  };
}

export interface EnrichmentResult {
  detailedReport: any;
  revenueLoss: {
    status: "not_measured";
    annual: null;
    monthly: null;
  };
  /** Verified owner email if found, null otherwise */
  verifiedEmail: string | null;
  /** Review channel selected from verified public data. Phones remain research-only. */
  outreachChannel: "email" | "none";
}

/**
 * Complete Enrichment Pipeline
 * Combines all analysis functions to populate detailedReport.
 * Also runs public email enrichment. It never sends or prepares cold SMS.
 */
export async function enrichLead(lead: {
  id: number;
  userId: number;
  companyName: string;
  websiteUrl: string;
  category: string;
  location: string;
  screenshotUrl: string | null;
  prestigeScore: number | null;
  phone?: string | null;
}): Promise<EnrichmentResult> {
  console.log(`[Enrichment] Starting enrichment for ${lead.companyName}`);
  const revenueImpact = buildNotMeasuredRevenueImpact();

  // Technical audit
  const technicalAudit = await performTechnicalAudit(lead.websiteUrl);

  // Conversion leaks (only if screenshot exists)
  let conversionLeaks: string[] = [];
  if (lead.screenshotUrl) {
    conversionLeaks = await detectConversionLeaks(
      lead.screenshotUrl,
      lead.companyName
    );
  }

  // Competitor analysis
  const competitorAnalysis = await findCompetitorGaps(
    lead.companyName,
    lead.category,
    lead.location
  );

  // Build detailed report
  const detailedReport = {
    report_version: "velvet.audit-report.v2",
    visual_audit: {
      score: lead.prestigeScore || 0,
      basis: "inferred",
      critique: `Screenshot review score: ${lead.prestigeScore ?? "not available"}/100. This is an internal visual-review heuristic, not a measurement of revenue, rankings, mobile compatibility, or conversion performance.`,
    },
    technical_audit: {
      load_speed: technicalAudit.loadSpeed,
      mobile_friendly: technicalAudit.mobileFriendly,
      https_url: technicalAudit.httpsUrl,
      ssl_enabled: technicalAudit.sslEnabled,
      measurement_status: technicalAudit.measurementStatus,
      issues: technicalAudit.issues,
    },
    conversion_leaks: conversionLeaks,
    conversion_observation_basis: "inferred_from_screenshot",
    competitor_analysis: {
      status: competitorAnalysis.status,
      competitor_url: competitorAnalysis.competitorUrl,
      gap_found: competitorAnalysis.gapFound,
    },
    revenue_impact: {
      status: revenueImpact.status,
      annual_loss: revenueImpact.annualLoss,
      monthly_loss: revenueImpact.monthlyLoss,
      explanation: revenueImpact.explanation,
    },
    suggested_fix:
      "Review the classified visual, navigation, and contact-path observations. Measure mobile behavior and performance separately before making technical or business-impact claims.",
  };

  // ── Email Enrichment & Outreach Routing ──────────────────────────────────
  let verifiedEmail: string | null = null;
  let outreachChannel: "email" | "none" = "none";

  try {
    const domain = lead.websiteUrl
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];

    const contact: EnrichedContact | null = await findVerifiedOwnerEmail(
      domain,
      {
        userId: lead.userId,
        leadId: lead.id,
      }
    );

    if (contact) {
      verifiedEmail = contact.email;
      outreachChannel = "email";
      console.log(
        `[Enrichment] Found a verified owner email for ${lead.companyName} (${contact.confidence}% confidence via ${contact.source})`
      );
    } else if (lead.phone) {
      outreachChannel = "none";
      console.log(
        `[Enrichment] No verified email found for ${lead.companyName}. The public phone is retained for research only; cold SMS is disabled.`
      );
    } else {
      console.log(
        `[Enrichment] No email or phone for ${lead.companyName} — no outreach channel available`
      );
    }
  } catch (enrichErr) {
    console.error(
      `[Enrichment] Email enrichment error for ${lead.companyName}:`,
      enrichErr
    );
  }

  console.log(
    `[Enrichment] Completed for ${lead.companyName} - Revenue impact not measured | Channel: ${outreachChannel}`
  );

  return {
    detailedReport,
    revenueLoss: {
      status: "not_measured",
      annual: null,
      monthly: null,
    },
    verifiedEmail,
    outreachChannel,
  };
}
