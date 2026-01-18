import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { assets, type InsertAsset } from "../drizzle/schema";
import { nanoid } from "nanoid";

/**
 * Business DNA extracted from visual audit
 */
export interface BusinessDNA {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontStyle: string; // e.g., "modern sans-serif", "elegant serif"
  brandVibe: string; // e.g., "luxury", "industrial", "minimal"
  industry: string;
  companyName: string;
}

/**
 * Extract Business DNA from visual audit findings
 */
export function extractBusinessDNA(
  companyName: string,
  websiteUrl: string,
  visualDebt: any
): BusinessDNA {
  // Parse visual debt to extract brand characteristics
  const designIssues = visualDebt?.categories?.design || [];
  const brandingIssues = visualDebt?.categories?.branding || [];

  // Default DNA if audit doesn't provide enough info
  const dna: BusinessDNA = {
    primaryColor: "#1a1a1a",
    secondaryColor: "#ffffff",
    accentColor: "#f7e7ce",
    fontStyle: "modern sans-serif",
    brandVibe: "professional",
    industry: "general",
    companyName,
  };

  // Extract colors from design issues (if mentioned)
  const colorMentions = designIssues.filter((issue: any) =>
    issue.description?.toLowerCase().includes("color")
  );
  if (colorMentions.length > 0) {
    // Try to extract hex colors from descriptions
    const hexPattern = /#[0-9A-Fa-f]{6}/g;
    const colors = colorMentions
      .map((issue: any) => issue.description?.match(hexPattern))
      .flat()
      .filter(Boolean);
    if (colors.length > 0) {
      dna.primaryColor = colors[0] || dna.primaryColor;
      dna.secondaryColor = colors[1] || dna.secondaryColor;
      dna.accentColor = colors[2] || dna.accentColor;
    }
  }

  // Infer industry from URL
  const url = websiteUrl.toLowerCase();
  if (url.includes("pool") || url.includes("spa")) {
    dna.industry = "pool & spa";
    dna.brandVibe = "luxury resort";
  } else if (url.includes("construction") || url.includes("contractor")) {
    dna.industry = "construction";
    dna.brandVibe = "industrial strength";
  } else if (url.includes("restaurant") || url.includes("food")) {
    dna.industry = "food & beverage";
    dna.brandVibe = "artisanal craft";
  }

  return dna;
}

/**
 * Generate asset prompts based on Business DNA
 */
function generateAssetPrompts(dna: BusinessDNA): {
  socialPosts: string[];
  webBanner: string;
} {
  const baseStyle = `${dna.brandVibe} aesthetic, ${dna.fontStyle} typography, color palette: ${dna.primaryColor} ${dna.secondaryColor} ${dna.accentColor}`;

  return {
    socialPosts: [
      `Professional Instagram post for ${dna.companyName}, ${dna.industry} business. ${baseStyle}. High-end marketing design, clean layout, bold headline, modern composition. 1080x1080px square format.`,
      `Facebook ad creative for ${dna.companyName}, ${dna.industry} services. ${baseStyle}. Eye-catching visual, compelling call-to-action, professional photography style. 1200x628px format.`,
      `LinkedIn post graphic for ${dna.companyName}, ${dna.industry} company. ${baseStyle}. Corporate professional design, trust-building imagery, sophisticated layout. 1200x627px format.`,
    ],
    webBanner: `Modern hero banner for ${dna.companyName} website, ${dna.industry} business. ${baseStyle}. Futuristic web design, glassmorphism elements, high-end branding, cinematic composition. 1920x600px wide format.`,
  };
}

/**
 * Generate all assets for a lead
 */
export async function generateAssetsForLead(
  leadId: number,
  companyName: string,
  websiteUrl: string,
  visualDebt: any
): Promise<{ success: boolean; assetCount: number; error?: string }> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Database unavailable");
    }

    // Step 1: Extract Business DNA
    const dna = extractBusinessDNA(companyName, websiteUrl, visualDebt);

    // Step 2: Generate prompts
    const prompts = generateAssetPrompts(dna);

    // Step 3: Generate and store social posts
    const socialAssets: InsertAsset[] = [];
    for (const prompt of prompts.socialPosts) {
      const result = await generateImage({ prompt });
      if (!result?.url) {
        throw new Error("Image generation failed: no URL returned");
      }

      // Download and re-upload to our S3 for persistence
      const response = await fetch(result.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const s3Key = `assets/${leadId}/social-${nanoid()}.png`;
      const { url: s3Url } = await storagePut(s3Key, buffer, "image/png");

      socialAssets.push({
        leadId,
        type: "social_post",
        url: s3Url,
        s3Key,
        metadata: JSON.stringify({ prompt, dna }),
      });
    }

    // Step 4: Generate and store web banner
    const bannerResult = await generateImage({
      prompt: prompts.webBanner,
    });
    if (!bannerResult?.url) {
      throw new Error("Banner generation failed: no URL returned");
    }

    const bannerResponse = await fetch(bannerResult.url);
    const bannerBuffer = Buffer.from(await bannerResponse.arrayBuffer());
    const bannerS3Key = `assets/${leadId}/banner-${nanoid()}.png`;
    const { url: bannerS3Url } = await storagePut(
      bannerS3Key,
      bannerBuffer,
      "image/png"
    );

    const bannerAsset: InsertAsset = {
      leadId,
      type: "web_banner",
      url: bannerS3Url,
      s3Key: bannerS3Key,
      metadata: JSON.stringify({ prompt: prompts.webBanner, dna }),
    };

    // Step 5: Save all assets to database
    const allAssets = [...socialAssets, bannerAsset];
    await db.insert(assets).values(allAssets);

    return {
      success: true,
      assetCount: allAssets.length,
    };
  } catch (error) {
    console.error("[Visionary] Asset generation failed:", error);
    return {
      success: false,
      assetCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all assets for a lead
 */
export async function getAssetsByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const { eq } = await import("drizzle-orm");
  return db.select().from(assets).where(eq(assets.leadId, leadId));
}
