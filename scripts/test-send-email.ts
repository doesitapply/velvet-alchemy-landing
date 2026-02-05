import 'dotenv/config';
import { sendEmailViaGmail } from '../server/lib/emailOutreach';

async function main() {
  const result = await sendEmailViaGmail({
    to: 'audit-sim@invalid.test',
    subject: 'Velvet Alchemy audit harness check',
    body: 'This is a test send from the hostile audit harness. Please ignore.'
  });

  console.log('Send result:', result);
}

main().catch(err => {
  console.error('Email send failed:', err);
  process.exitCode = 1;
});
