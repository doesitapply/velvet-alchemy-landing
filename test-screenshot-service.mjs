import { captureScreenshot } from './dist/screenshot.js';

async function testScreenshotService() {
  const testUrls = [
    'https://example.com',
    'https://google.com',
    'https://github.com',
  ];
  
  console.log('Testing screenshot service with real URLs...\n');
  
  for (const url of testUrls) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${url}`);
    console.log('='.repeat(60));
    
    try {
      const result = await captureScreenshot(url, 30000);
      
      if (result.success) {
        console.log('✅ SUCCESS!');
        console.log('Buffer size:', result.buffer.byteLength, 'bytes');
      } else {
        console.log('❌ FAILED');
        console.log('Error:', result.error);
      }
    } catch (error) {
      console.log('❌ EXCEPTION:', error.message);
    }
  }
}

testScreenshotService();
