/**
 * Test Optimized Pipeline
 * Verify 2-stage pipeline (screenshot+audit → outreach) works and costs $0.01-0.06 per lead
 */

import { executePipeline } from './server/orchestrator.js';

async function testOptimizedPipeline() {
  console.log('🧪 Testing Optimized Pipeline...\n');
  
  // Test lead data
  const testLead = {
    id: 999999,
    website: 'https://example.com',
    businessName: 'Test Business',
    category: 'restaurant',
    city: 'Reno',
    state: 'NV'
  };
  
  console.log('📊 Expected Pipeline:');
  console.log('  Stage 1: Screenshot + Audit (GPT-4o Vision)');
  console.log('  Stage 2: Outreach Draft (GPT-4o)');
  console.log('  ❌ NO automatic asset generation\n');
  
  console.log('💰 Expected Cost:');
  console.log('  Screenshot: $0.00 (Microlink free tier)');
  console.log('  GPT-4o Audit: $0.01-0.05');
  console.log('  GPT-4o Outreach: $0.001');
  console.log('  Total: $0.01-0.06 per lead\n');
  
  console.log('🚀 Starting pipeline execution...\n');
  
  try {
    const startTime = Date.now();
    
    // Execute pipeline
    await executePipeline(testLead.id);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Pipeline completed in ${duration}s`);
    console.log('\n📋 Verification Checklist:');
    console.log('  [ ] Screenshot captured');
    console.log('  [ ] Visual audit completed (prestige score calculated)');
    console.log('  [ ] Outreach draft generated');
    console.log('  [ ] NO assets generated automatically');
    console.log('  [ ] Total cost < $0.06');
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    console.error(error.stack);
  }
}

// Run test
testOptimizedPipeline();
