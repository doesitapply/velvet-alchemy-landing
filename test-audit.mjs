import 'dotenv/config';
import { executePipeline } from './server/orchestrator.ts';

const leadId = 1;
const userId = 1;

console.log(`Starting pipeline test for lead ${leadId}...`);

try {
  await executePipeline(leadId, userId);
  console.log('✅ Pipeline execution started!');
  console.log('Verify results in the DB or via the dashboard.');
} catch (error) {
  console.error('❌ Pipeline failed:', error);
}
