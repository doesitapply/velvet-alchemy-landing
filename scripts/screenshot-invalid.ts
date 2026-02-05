import { captureScreenshot } from '../server/screenshot';

async function main() {
  const url = 'ftp://totally-invalid';
  const result = await captureScreenshot(url, 2000);
  console.log('Result:', result);
}

main().catch(err => console.error(err));
