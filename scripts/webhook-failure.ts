import 'dotenv/config';
import express from 'express';
import { registerStripeWebhook } from '../server/webhooks';

async function main() {
  const app = express();
  registerStripeWebhook(app);

  const server = await new Promise<import('http').Server>((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind port');
  const url = `http://127.0.0.1:${address.port}/api/stripe/webhook`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=123,v1=fake'
    },
    body: JSON.stringify({ type: 'checkout.session.completed' })
  });

  const text = await res.text();
  console.log('Webhook status:', res.status);
  console.log('Webhook body:', text);

  server.close();
}

main().catch(err => {
  console.error('Webhook failure simulation error:', err);
});
