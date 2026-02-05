import 'dotenv/config';
import { executePipeline } from '../server/orchestrator';

async function main() {
  const result = await executePipeline(1, 1);
  console.log('Pipeline result:', result);
}

main().catch(err => {
  console.error('Pipeline execution failed:', err);
});
