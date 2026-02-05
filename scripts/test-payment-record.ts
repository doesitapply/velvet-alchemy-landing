import 'dotenv/config';
import { createLead, createPaymentRecord, getPaymentBySessionId, updatePaymentBySessionId, updateLead, getLeadById } from '../server/db';

async function main() {
  const lead = await createLead({
    userId: 1,
    companyName: 'Test Lead',
    websiteUrl: 'https://example.com',
    status: 'pending'
  });

  const payment = await createPaymentRecord({
    lead_id: lead.id,
    stripe_checkout_session_id: 'cs_test_123',
    amount: 500000,
    currency: 'usd',
    status: 'pending',
    package_type: 'standard',
    payment_link: 'https://checkout.stripe.com/test'
  });

  console.log('Created payment record:', payment);

  await updatePaymentBySessionId('cs_test_123', {
    status: 'completed',
    paid_at: new Date(),
    stripe_payment_intent_id: 'pi_test_456'
  });

  const updatedPayment = await getPaymentBySessionId('cs_test_123');
  console.log('Updated payment record:', updatedPayment);

  await updateLead(lead.id, { status: 'paid' });
  const updatedLead = await getLeadById(lead.id);
  console.log('Updated lead status:', updatedLead?.status);
}

main().catch(err => {
  console.error('Payment record test failed:', err);
  process.exitCode = 1;
});
