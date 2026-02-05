import { captureScreenshot } from '../server/screenshot';

async function main() {
  const url = 'https://nonexistent-domain-velvet-audit.test';
  const result = await captureScreenshot(url, 5000);
  console.log('Result:', result);
}

main().catch(err => {
  console.error('Screenshot failure script error:', err);
});
