async function testScreenshot() {
  const url = 'https://example.com';
  const screenshotApiUrl = 'https://api.screenshotone.com/take';
  const params = new URLSearchParams({
    url: url,
    viewport_width: '1024',
    viewport_height: '600',
    format: 'png',
    block_ads: 'true',
    block_cookie_banners: 'true',
    block_trackers: 'true',
    cache: 'false',
  });

  try {
    console.log('Testing ScreenshotOne API...');
    const response = await fetch(`${screenshotApiUrl}?${params.toString()}`, {
      method: 'GET',
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error body:', text);
      
      // Try fallback
      console.log('\nTrying fallback API (screenshot.rocks)...');
      const fallbackUrl = 'https://api.screenshot.rocks/screenshot';
      const fallbackParams = new URLSearchParams({
        url: url,
        width: '1024',
        height: '600',
      });
      
      const fallbackResponse = await fetch(`${fallbackUrl}?${fallbackParams.toString()}`, {
        method: 'GET',
      });
      
      console.log('Fallback Status:', fallbackResponse.status);
      console.log('Fallback Status Text:', fallbackResponse.statusText);
      
      if (!fallbackResponse.ok) {
        const fallbackText = await fallbackResponse.text();
        console.log('Fallback Error body:', fallbackText);
      } else {
        console.log('Fallback Success! Screenshot captured.');
      }
    } else {
      console.log('Success! Screenshot captured.');
    }
  } catch (error) {
    console.error('Fetch error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testScreenshot();
