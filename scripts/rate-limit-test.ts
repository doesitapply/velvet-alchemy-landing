import { checkRateLimit } from '../server/governor';

async function main() {
  for (let i = 1; i <= 11; i++) {
    try {
      await checkRateLimit(1, 'lead_create');
      console.log(`Attempt ${i}: allowed`);
    } catch (err) {
      console.error(`Attempt ${i}: blocked ->`, err);
      break;
    }
  }
}

main().catch(err => console.error('Rate limit test failed:', err));
