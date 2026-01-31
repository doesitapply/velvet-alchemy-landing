import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { assets, type InsertAsset } from "../drizzle/schema";
import { nanoid } from "nanoid";
import { invokeAI } from "./aiProvider";

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
  shortBrandingName: string; // Brief version for typography rendering
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

  // Create a short branding name for clean typography
  let shortBrandingName = companyName
    .replace(/(Injury|&|Car|Accident|Lawyers|LLC|Inc|Corp|Group|Firm|Associates|Law|Legal)/gi, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

  if (!shortBrandingName || shortBrandingName.length < 3) {
    shortBrandingName = companyName.split(' ')[0];
  }

  // Default DNA if audit doesn't provide enough info
  const dna: BusinessDNA = {
    primaryColor: "#1a1a1a",
    secondaryColor: "#ffffff",
    accentColor: "#f7e7ce",
    fontStyle: "modern sans-serif",
    brandVibe: "professional",
    industry: "general",
    companyName,
    shortBrandingName: shortBrandingName.toUpperCase(),
  };

  // Extract colors from design issues (if mentioned)
  const colorMentions = designIssues.filter((issue: any) =>
    issue.description?.toLowerCase().includes("color")
  );
  if (colorMentions.length > 0) {
    const hexPattern = /#[0-9A-Fa-f]{6}/g;
    const colors = colorMentions
      .map((issue: any) => issue.description?.match(hexPattern))
      .filter((match: any) => match !== null && match !== undefined)
      .flat()
      .filter(Boolean);
    if (colors && colors.length > 0) {
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
  } else if (url.includes("mgalaw") || url.includes("injury") || url.includes("accident")) {
    dna.industry = "personal injury law";
    dna.brandVibe = "elite legal architect";
  } else if (url.includes("construction") || url.includes("contractor")) {
    dna.industry = "construction";
    dna.brandVibe = "industrial strength";
  }

  return dna;
}

/**
 * Generate asset prompts based on Business DNA using AI
 */
async function generateAssetPrompts(dna: BusinessDNA): Promise<{
  socialPosts: string[];
  webBanner: string;
}> {
  const prompt = `You are a high-fidelity Design Architect. Your mission is to generate image prompts for DALL-E 3 that yield FLAWLESS TYPOGRAPHIC ACCURACY.

TARGET TEXT: "${dna.shortBrandingName}"
CONTEXT: ${dna.companyName} (${dna.industry})
STYLE: ${dna.brandVibe} aesthetic, ${dna.fontStyle} typography.

CRITICAL INSTRUCTIONS FOR TEXT RENDERING:
1. Every prompt MUST start with: "An image showcasing the large, bold, high-contrast text '${dna.shortBrandingName}'."
2. The text "${dna.shortBrandingName}" must be the only text rendered. 
3. Use words like "sharp edges", "perfect spelling", "premium signage", and "centered 3D lettering".
4. Focus on the characters: ${dna.shortBrandingName.split('').join('-')}.

Generate 3 social post prompts and 1 web banner prompt. Return as valid JSON.`;

  const response = await invokeAI({
    messages: [
      {
        role: "system",
        content: `You are the Lead Art Director at a high-prestige advertising agency. Your specialty is "Zero-Error Typographic Prompting" for AI image generators. 
        You know that DALL-E 3 performs best when the text requirement is the VERY FIRST sentence and uses terms like "bold sans-serif lettering" or "elegant metal typography". 
        You always double-check that the company name "${dna.companyName}" is used exactly as written, with all spaces and capitals preserved.`
      },
      { role: "user", content: prompt }
    ],
    responseFormat: "json_schema",
    schema: {
      name: "asset_prompts",
      strict: true,
      schema: {
        type: "object",
        properties: {
          socialPosts: { type: "array", items: { type: "string" } },
          webBanner: { type: "string" }
        },
        required: ["socialPosts", "webBanner"],
        additionalProperties: false
      }
    }
  });

  return JSON.parse(response.content);
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

    // Step 2: Generate prompts using AI
    const prompts = await generateAssetPrompts(dna);

    // Step 3: Generate and store social posts
    const socialAssets: InsertAsset[] = [];
    for (const prompt of prompts.socialPosts) {
      const result = await generateImage({ prompt });
      if (!result?.url) {
        throw new Error("Image generation failed: no URL returned");
      }

      console.log(`[Visionary] Generated image: ${result.url}`);

      let s3Url = result.url;
      let s3Key = result.key || "";

      // Only attempt re-upload if it's a real external URL (e.g. from DALL-E directly)
      // and not already processed by our storage simulation
      if (result.url.startsWith('http') && !result.url.includes('velvet-alchemy.com/simulated') && !s3Key) {
        try {
          const response = await fetch(result.url);
          const buffer = Buffer.from(await response.arrayBuffer());
          s3Key = `assets/${leadId}/social-${nanoid()}.png`;
          const uploadRes = await storagePut(s3Key, buffer, "image/png");
          s3Url = uploadRes.url;
          s3Key = uploadRes.key;
        } catch (e) {
          console.warn("[Visionary] Failed to re-upload asset, using original URL", e);
        }
      }

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

    console.log(`[Visionary] Generated banner: ${bannerResult.url}`);

    let bannerS3Url = bannerResult.url;
    let bannerS3Key = bannerResult.key || "";

    if (bannerResult.url.startsWith('http') && !bannerResult.url.includes('velvet-alchemy.com/simulated') && !bannerS3Key) {
      try {
        const bannerResponse = await fetch(bannerResult.url);
        const bannerBuffer = Buffer.from(await bannerResponse.arrayBuffer());
        bannerS3Key = `assets/${leadId}/banner-${nanoid()}.png`;
        const uploadRes = await storagePut(bannerS3Key, bannerBuffer, "image/png");
        bannerS3Url = uploadRes.url;
        bannerS3Key = uploadRes.key;
      } catch (e) {
        console.warn("[Visionary] Failed to re-upload banner, using original URL", e);
      }
    }

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
  const results = await db.select().from(assets).where(eq(assets.leadId, leadId));
  console.log(`[Visionary] getAssetsByLeadId(${leadId}) returned ${results.length} assets.`);
  results.forEach((a: any) => console.log(`   - Asset: ${a.type}, URL: ${a.url}`));
  return results;
}
