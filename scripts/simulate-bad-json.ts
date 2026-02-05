import 'dotenv/config';
import { analyzeVisualDebt } from '../server/visualAudit';

const originalParse = JSON.parse;
(JSON as any).parse = function(text: string, reviver?: (this: any, key: string, value: any) => any) {
  if (typeof text === 'string' && text.includes('visualDebt')) {
    throw new SyntaxError('Injected parse failure to simulate malformed AI JSON');
  }
  return originalParse(text, reviver as any);
};

async function main() {
  const screenshotUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop';
  const result = await analyzeVisualDebt(screenshotUrl, 'https://shopify.com', 'Shopify');
  console.log('Simulated malformed output result:', result);
}

main().catch(err => {
  console.error('Simulation failed:', err);
}).finally(() => {
  (JSON as any).parse = originalParse;
});
