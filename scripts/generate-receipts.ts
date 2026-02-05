
import 'dotenv/config';
import crypto from 'crypto';
import { db, createLead, createPaymentRecord, getPaymentBySessionId, getLeadById } from '../server/db';
import { eq } from 'drizzle-orm';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PORT = 3000;

async function generateReceipts() {
    if (!WEBHOOK_SECRET) {
        console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
        process.exit(1);
    }

    console.log("\n🧾 GENERATING PAYMENT RECEIPTS 🧾\n");

    // 1. SETUP DATA
    const timestamp = Date.now();
    const sessionId = `cs_test_RECEIPT_${timestamp}`;

    console.log("1. [Setup] Creating Mock Lead & Pending Payment...");
    const lead = await createLead({
        userId: 1,
        companyName: `Receipt Corp ${timestamp}`,
        websiteUrl: `https://receipt-${timestamp}.com`,
    });

    await createPaymentRecord({
        lead_id: lead.id,
        stripe_checkout_session_id: sessionId,
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        package_type: 'premium',
    });

    const beforePayment = await getPaymentBySessionId(sessionId);
    const beforeLead = await getLeadById(lead.id);

    console.log(`   > Lead ID: ${lead.id} | Status: ${beforeLead?.status}`);
    console.log(`   > Payment ID: ${sessionId} | Status: ${beforePayment?.status}`);

    // 2. CONSTRUCT PAYLOAD
    const payload = JSON.stringify({
        id: `evt_test_${timestamp}`,
        object: 'event',
        type: 'checkout.session.completed',
        created: Math.floor(timestamp / 1000),
        data: {
            object: {
                id: sessionId,
                object: 'checkout.session',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                payment_intent: `pi_test_${timestamp}`,
                metadata: {
                    lead_id: lead.id,
                }
            }
        }
    });

    // 3. SIGN PAYLOAD
    const time = Math.floor(Date.now() / 1000);
    const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(`${time}.${payload}`)
        .digest('hex');

    const stripeSignature = `t=${time},v1=${signature}`;

    console.log("\n2. [Action] POSTing Signed Webhook to Server...");
    console.log(`   > Target: http://localhost:${PORT}/api/stripe/webhook`);
    console.log(`   > Signature: ${stripeSignature.substring(0, 30)}...`);

    const response = await fetch(`http://localhost:${PORT}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': stripeSignature,
        },
        body: payload
    });

    console.log(`   > Response: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`   > Body: ${text}`);

    if (!response.ok) {
        console.error("❌ Webhook request failed.");
        process.exit(1);
    }

    // 4. VERIFY PERSISTENCE
    console.log("\n3. [Verification] Checking Database State...");

    // Give DB a moment to update
    await new Promise(r => setTimeout(r, 1000));

    const afterPayment = await getPaymentBySessionId(sessionId);
    const afterLead = await getLeadById(lead.id);

    console.log(`   > Payment Status: ${beforePayment?.status} -> ${afterPayment?.status} ${afterPayment?.status === 'completed' ? '✅' : '❌'}`);
    console.log(`   > Lead Status:    ${beforeLead?.status}    -> ${afterLead?.status}       ${afterLead?.status === 'paid' ? '✅' : '❌'}`);

    if (afterPayment?.status === 'completed' && afterLead?.status === 'paid') {
        console.log("\n✅ SUCCESS: Full End-to-End Payment Flow Verified.");
    } else {
        console.error("\n❌ FAILURE: Database state did not update as expected.");
    }

    process.exit(0);
}

generateReceipts().catch(console.error);
