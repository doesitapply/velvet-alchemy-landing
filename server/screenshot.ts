import { trackApiCall, SCREENSHOT_COST_CENTS } from "./apiCostTracker";

export interface ScreenshotResult {
  buffer: Buffer;
  success: boolean;
  error?: string;
}

/**
 * Captures a screenshot of a given URL using a serverless screenshot service
 * Falls back to a simple placeholder if service is unavailable
 * @param url The URL to capture
 * @param timeout Maximum time to wait for screenshot (ms)
 * @returns Screenshot buffer or error
 */
export async function captureScreenshot(
  url: string,
  timeout: number = 30000
): Promise<ScreenshotResult> {
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

    // Use ScreenshotOne API (free tier: 100/month)
    // Alternative: screenshotapi.net, apiflash.com, or screenshotmachine.com
    const screenshotApiUrl = `https://api.screenshotone.com/take`;
    const params = new URLSearchParams({
      url: url,
      viewport_width: '1024',
      viewport_height: '600',
      format: 'png',
      block_ads: 'true',
      block_cookie_banners: 'true',
      block_trackers: 'true',
      cache: 'false',
      // Free tier doesn't require access_key
    });

    const response = await fetch(`${screenshotApiUrl}?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      // If API fails, try alternative: screenshot.rocks (completely free, no API key)
      const fallbackUrl = `https://api.screenshot.rocks/screenshot`;
      const fallbackParams = new URLSearchParams({
        url: url,
        width: '1024',
        height: '600',
      });

      const fallbackResponse = await fetch(`${fallbackUrl}?${fallbackParams.toString()}`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Screenshot services unavailable: ${response.status}, ${fallbackResponse.status}`);
      }

      const buffer = await fallbackResponse.arrayBuffer();
      return {
        buffer: Buffer.from(buffer),
        success: true,
      };
    }

    const buffer = await response.arrayBuffer();
    
    // Track API cost (async, don't block response)
    trackApiCall({
      userId: 0, // Will be set by caller if available
      service: 'screenshot',
      operation: 'capture_screenshot',
      estimatedCostCents: SCREENSHOT_COST_CENTS,
      requestData: { url, viewport: '1024x600' },
      responseStatus: 'success',
    }).catch(err => console.error('[Screenshot] Cost tracking failed:', err));

    return {
      buffer: Buffer.from(buffer),
      success: true,
    };
  } catch (error: any) {
    console.error('[Screenshot] Failed to capture:', error);

    // Return a placeholder image instead of failing completely
    // This ensures the audit can still proceed even if screenshot fails
    return {
      buffer: Buffer.from(''),
      success: false,
      error: error.message || 'Screenshot service unavailable',
    };
  }
}
