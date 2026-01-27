// Test the screenshot service by making a direct HTTP request to the tRPC endpoint

async function testScreenshotEndpoint() {
  const testUrl = 'http://example.com';
  
  console.log('Testing screenshot service via HTTP...');
  console.log('Target URL:', testUrl);
  
  try {
    // Call the tRPC endpoint directly
    const response = await fetch('http://localhost:3000/api/trpc/leads.captureScreenshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId: 1, // Test with first lead
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testScreenshotEndpoint();
