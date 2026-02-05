import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY missing');
  }
  const stripe = new Stripe(key, { apiVersion: '2025-12-15.clover' });
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Audit Package Test',
            description: 'Hostile audit checkout test'
          },
          unit_amount: 1000,
        },
        quantity: 1,
      }
    ],
    mode: 'payment',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  });
  console.log('Created session:', session.id);
  console.log('Checkout URL:', session.url);
}

main().catch(err => {
  console.error('Stripe test failed:', err);
  process.exitCode = 1;
});
