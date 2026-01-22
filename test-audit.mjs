import { executePipeline } from './server/orchestrator.js';

// Test audit on lead ID 150001 (Ira Hansen Plumbing)
console.log('Starting audit pipeline test...');
console.log('Lead ID: 150001 (Ira Hansen and Sons Plumbing)');
console.log('---');

try {
  await executePipeline(150001);
  console.log('✅ Pipeline started successfully!');
  console.log('Check the database for progress updates.');
} catch (error) {
  console.error('❌ Pipeline failed:', error.message);
  console.error(error.stack);
}
