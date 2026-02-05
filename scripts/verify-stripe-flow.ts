
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createCheckoutSession } from '../server/paymentRouter'; // Can't import router directly like this usually in tRPC context
// Actually, let's just use the server logic directly or use a tiny script that calls the procedure if possible. 
// Easier: Just use the Stripe SDK directly in a script to replicate what the router does, to get a session ID.
import Stripe from 'stripe';
import { db, createLead, createPaymentRecord, getAllPayments, getAllLeads } from '../server/db.ts';
import { eq } from 'drizzle-orm/expressions';

async function runTest() {
    console.log("1. Creating Verification Lead...");
    const lead = await createLead({
        userId: 1,
        companyName: "Audit Proof LLC",
        websiteUrl: "https://proof.com",
    });
    console.log("Lead Created:", lead.id);

    console.log("2. Creating Checkout Session...");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
            price_data: {
                currency: "usd",
                product_data: { name: "Audit Proof Package" },
                unit_amount: 2000,
            },
            quantity: 1,
        }],
        mode: "payment",
        success_url: "http://localhost:3000/success",
        cancel_url: "http://localhost:3000/cancel",
        metadata: {
            lead_id: lead.id.toString(),
            package_type: "basic",
            company_name: lead.companyName,
            user_id: "1",
        },
    });

    console.log("Session Created:", session.id);
    console.log("Checkout URL:", session.url);

    // Create the pending payment record as the app would
    await createPaymentRecord({
        lead_id: lead.id,
        stripe_checkout_session_id: session.id,
        amount: 2000,
        currency: "usd",
        status: "pending",
        package_type: "basic",
        payment_link: session.url || undefined,
    });
    console.log("Pending Payment Record Created.");

    return session.id;
}

runTest().then(id => {
    console.log(`__SESSION_ID:${id}__`);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
