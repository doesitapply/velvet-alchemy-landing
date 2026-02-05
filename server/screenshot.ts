import { trackApiCall, SCREENSHOT_COST_CENTS } from "./apiCostTracker";

export interface ScreenshotResult {
  buffer: Buffer;
  contentType?: string;
  success: boolean;
  error?: string;
}

/**
 * Captures a screenshot of a given URL using free screenshot services
 * Primary: Microlink.io (PNG, no API key)
 * Fallback: Screenshotmachine.com (GIF, no API key)
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

    // Primary: Microlink.io (free, no API key, returns PNG)
    // Docs: https://microlink.io/docs/api/parameters/screenshot
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    
    console.log('[Screenshot] Attempting Microlink.io for:', url);
    
    try {
      const response = await fetch(microlinkUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // Microlink returns the image directly when using embed=screenshot.url
        if (contentType && contentType.includes('image')) {
          const buffer = await response.arrayBuffer();
          console.log('[Screenshot] Success via Microlink.io:', buffer.byteLength, 'bytes');
          
          // Track API cost (async, don't block response)
          trackApiCall({
            userId: 0, // Will be set by caller if available
            service: 'screenshot',
            operation: 'capture_screenshot_microlink',
            estimatedCostCents: SCREENSHOT_COST_CENTS,
            requestData: { url, service: 'microlink' },
            responseStatus: 'success',
          }).catch(err => console.error('[Screenshot] Cost tracking failed:', err));

          return {
            buffer: Buffer.from(buffer),
            contentType: contentType || "image/png",
            success: true,
          };
        }
      }
      
      console.log('[Screenshot] Microlink failed with status:', response.status);
      const responseBody = await response.text();
      console.log('[Screenshot] Microlink response body:', responseBody);
    } catch (microlinkError: any) {
      console.log('[Screenshot] Microlink error:', microlinkError.message);
    }

    // Fallback: Screenshotmachine.com (free, no API key, returns GIF)
    // Docs: https://www.screenshotmachine.com/apidoc.php
    console.log('[Screenshot] Trying fallback: Screenshotmachine.com');
    
    const screenshotMachineUrl = `https://api.screenshotmachine.com/?key=&url=${encodeURIComponent(url)}&dimension=1024x600`;
    
    const fallbackResponse = await fetch(screenshotMachineUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(timeout),
    });

    if (!fallbackResponse.ok) {
      const errorBody = await fallbackResponse.text();
      throw new Error(`All screenshot services failed. Last status: ${fallbackResponse.status}. Body: ${errorBody}`);
    }

    const buffer = await fallbackResponse.arrayBuffer();
    console.log('[Screenshot] Success via Screenshotmachine.com:', buffer.byteLength, 'bytes');
    
    // Track API cost (async, don't block response)
    trackApiCall({
      userId: 0,
      service: 'screenshot',
      operation: 'capture_screenshot_fallback',
      estimatedCostCents: SCREENSHOT_COST_CENTS,
      requestData: { url, service: 'screenshotmachine' },
      responseStatus: 'success',
    }).catch(err => console.error('[Screenshot] Cost tracking failed:', err));

    return {
      buffer: Buffer.from(buffer),
      contentType: fallbackResponse.headers.get('content-type') || 'image/gif',
      success: true,
    };
  } catch (error: any) {
    console.error('[Screenshot] All services failed:', error.message);

    // Track failed API call
    trackApiCall({
      userId: 0,
      service: 'screenshot',
      operation: 'capture_screenshot_failed',
      estimatedCostCents: 0,
      requestData: { url },
      responseStatus: 'error',
    }).catch(err => console.error('[Screenshot] Cost tracking failed:', err));

    // Return error instead of empty buffer
    return {
      buffer: Buffer.from(''),
      success: false,
      error: error.message || 'All screenshot services unavailable',
    };
  }
}
