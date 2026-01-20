import { chromium } from 'playwright';

export interface ScreenshotResult {
  buffer: Buffer;
  success: boolean;
  error?: string;
}

/**
 * Captures a screenshot of a given URL using Playwright
 * @param url The URL to capture
 * @param timeout Maximum time to wait for page load (ms)
 * @returns Screenshot buffer or error
 */
export async function captureScreenshot(
  url: string,
  timeout: number = 30000
): Promise<ScreenshotResult> {
  let browser;
  
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        buffer: Buffer.from(''),
        success: false,
        error: 'Invalid URL protocol. Must be http or https.',
      };
    }

    // Launch headless browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1024, height: 600 }, // Reduced for faster processing
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Navigate to URL with fast load strategy
    // Use domcontentloaded instead of networkidle to avoid waiting for trackers/analytics
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Much faster than networkidle
      timeout: Math.min(timeout, 10000), // Cap at 10 seconds max
    });
    
    // Wait an additional 2 seconds for critical assets to load
    await page.waitForTimeout(2000);

    // Take screenshot
    const buffer = await page.screenshot({
      type: 'png',
      fullPage: false, // Only capture viewport for MVP
    });

    await browser.close();

    return {
      buffer: Buffer.from(buffer),
      success: true,
    };
  } catch (error: any) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    console.error('[Screenshot] Failed to capture:', error);

    return {
      buffer: Buffer.from(''),
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}
