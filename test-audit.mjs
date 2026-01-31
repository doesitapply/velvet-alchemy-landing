// Test the audit service by making a direct HTTP request to the tRPC endpoint

async function testAuditEndpoint() {
  const leadIds = [1]; // Test with lead ID 1
  
  console.log('Testing audit service via HTTP...');
  console.log('Target Lead IDs:', leadIds);

  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    // Call the tRPC endpoint directly
    const response = await fetch('http://localhost:3000/api/trpc/orchestrator.batchAuditSelected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadIds,
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

testAuditEndpoint();
