async function testAPIs() {
  const testUrl = 'https://example.com';
  
  const apis = [
    {
      name: 'API Flash (free tier)',
      url: `https://api.apiflash.com/v1/urltoimage?url=${encodeURIComponent(testUrl)}&width=1024&height=600`,
      method: 'GET'
    },
    {
      name: 'ScreenshotAPI.net (free tier)',
      url: `https://shot.screenshotapi.net/screenshot?url=${encodeURIComponent(testUrl)}&width=1024&height=600&output=image&file_type=png&wait_for_event=load`,
      method: 'GET'
    },
    {
      name: 'Microlink (free tier)',
      url: `https://api.microlink.io/?url=${encodeURIComponent(testUrl)}&screenshot=true&meta=false&embed=screenshot.url`,
      method: 'GET'
    },
    {
      name: 'Screenshotmachine.com (free tier)',
      url: `https://api.screenshotmachine.com/?key=&url=${encodeURIComponent(testUrl)}&dimension=1024x600`,
      method: 'GET'
    },
    {
      name: 'Thumbnail.ws (free tier)',
      url: `https://api.thumbnail.ws/api/${process.env.THUMBNAIL_WS_KEY || 'free'}/thumbnail/get?url=${encodeURIComponent(testUrl)}&width=1024`,
      method: 'GET'
    }
  ];
  
  for (const api of apis) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${api.name}`);
    console.log(`URL: ${api.url}`);
    console.log('='.repeat(60));
    
    try {
      const response = await fetch(api.url, {
        method: api.method,
        headers: api.headers || {},
      });
      
      console.log('Status:', response.status, response.statusText);
      console.log('Content-Type:', response.headers.get('content-type'));
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('image')) {
          console.log('✅ SUCCESS! Image returned');
          const buffer = await response.arrayBuffer();
          console.log('Image size:', buffer.byteLength, 'bytes');
        } else if (contentType && contentType.includes('json')) {
          const json = await response.json();
          console.log('JSON response:', JSON.stringify(json, null, 2));
        } else {
          const text = await response.text();
          console.log('Response (first 200 chars):', text.substring(0, 200));
        }
      } else {
        const text = await response.text();
        console.log('❌ Error:', text.substring(0, 300));
      }
    } catch (error) {
      console.log('❌ Fetch failed:', error.message);
    }
  }
}

testAPIs();
