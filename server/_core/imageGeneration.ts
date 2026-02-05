/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
  key?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // Prioritize Google "Nano Banana" for images as requested
  /*
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithGoogle(options);
    } catch (err) {
      console.warn("[ImageGen] Google Nano Banana failed, falling back to DALL-E:", err);
    }
  }
  */

  if (process.env.OPENAI_API_KEY) {
    return generateWithDallE(options);
  } else {
    throw new Error("No image generation service configured (need GEMINI_API_KEY or OPENAI_API_KEY)");
  }
}

async function generateWithGoogle(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const keys = [ENV.geminiApiKey, ENV.googleApiKey].filter(Boolean);
  if (keys.length === 0) throw new Error("No Google/Gemini API key configured");

  const model = "gemini-2.5-flash-image"; // Official "Nano Banana" model
  let lastError: any = null;

  for (const key of keys) {
    try {
      console.log(`[ImageGen] Invoking Google Nano Banana (${model}) with prompt: "${options.prompt.substring(0, 50)}..."`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `GIVE ME A HIGH-FIDELITY IMAGE. USER PROMPT: ${options.prompt}. 
              CRITICAL: YOU MUST SPELL ALL TEXT FLAWLESSLY. 
              IF THE PROMPT INCLUDES A COMPANY NAME, RENDER IT IN HIGH-PRESTIGE TYPOGRAPHY.`
            }]
          }]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 400 && (errorText.includes("INVALID_ARGUMENT") || errorText.includes("blocked"))) {
          console.warn(`[ImageGen] Key failed or blocked. Trying next key...`);
          lastError = new Error(errorText);
          continue;
        }
        throw new Error(`Google Nano Banana API failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      const base64Data = imagePart?.inlineData?.data;

      if (!base64Data) {
        console.warn("[ImageGen] Google response did not contain image data. Parts:", JSON.stringify(parts));
        throw new Error("Google Nano Banana returned no image data in parts");
      }

      const buffer = Buffer.from(base64Data, "base64");
      const { url: storageUrl, key: s3Key } = await storagePut(
        `generated/${Date.now()}.png`,
        buffer,
        "image/png"
      );

      return { url: storageUrl, key: s3Key };
    } catch (err: any) {
      lastError = err;
      console.warn(`[ImageGen] Google attempt failed: ${err.message || String(err)}`);
    }
  }

  throw lastError || new Error("All Google Nano Banana attempts failed");
}



async function generateWithDallE(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `USER PROMPT: ${options.prompt}. 
          CRITICAL INSTRUCTION: RENDER THE TEXT EXACTLY AS WRITTEN IN THE PROMPT. 
          The spelling must be perfect. No extra characters or symbols. 
          Use clean, professional, high-visibility typography as the central focus.`,
          n: 1,
          size: "1024x1024",
          quality: "hd",
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const error = new Error(`DALL-E generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);

        if (response.status >= 500 && i < maxRetries - 1) {
          console.warn(`[DALL-E] Internal error (500), retrying attempt ${i + 2}...`);
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw error;
      }

      const result = await response.json() as { data: Array<{ url: string }> };
      const imageUrl = result.data[0]?.url;

      if (!imageUrl) {
        throw new Error("DALL-E returned no image URL");
      }

      // Download and save to S3
      const imageResponse = await fetch(imageUrl);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const { url, key } = await storagePut(
        `generated/${Date.now()}.png`,
        buffer,
        "image/png"
      );

      return { url, key };
    } catch (err) {
      lastError = err;
      if (i === maxRetries - 1) break;
      console.warn(`[DALL-E] Generation attempt ${i + 1} failed: ${err}. Retrying...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastError || new Error("DALL-E generation failed after retries");
}

