import express, { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Register Stripe webhook handler
 * 
 * Handles checkout.session.completed events to update payment and lead status
 */
export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/webhooks/stripe",
    // Use raw body for Stripe signature verification
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        console.error("No Stripe signature found in webhook request");
        return res.status(400).send("No signature");
      }

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error("STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).send("Webhook secret not configured");
      }

      let event: Stripe.Event;

      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(session);
          break;

        case "checkout.session.expired":
          const expiredSession = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionExpired(expiredSession);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Return a 200 response to acknowledge receipt of the event
      res.json({ received: true });
    }
  );
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("Checkout session completed:", session.id);

  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    return;
  }

  try {
    // Update payment status to 'completed'
    await db.execute(
      `UPDATE payments 
       SET status = 'completed', 
           paid_at = NOW(),
           stripe_payment_intent_id = '${session.payment_intent}'
       WHERE stripe_checkout_session_id = '${session.id}'`
    );

    // Get lead ID from payment record
    const [paymentResult] = await db.execute(
      `SELECT lead_id FROM payments WHERE stripe_checkout_session_id = '${session.id}'`
    ) as any;

    if (paymentResult && paymentResult.length > 0) {
      const leadId = paymentResult[0].lead_id;

      // Update lead status to 'paid'
      await db.execute(
        `UPDATE leads SET status = 'paid' WHERE id = ${leadId}`
      );

      console.log(`Lead ${leadId} marked as paid`);
    }
  } catch (error) {
    console.error("Error handling checkout session completed:", error);
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log("Checkout session expired:", session.id);

  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    return;
  }

  try {
    // Update payment status to 'expired'
    await db.execute(
      `UPDATE payments 
       SET status = 'expired'
       WHERE stripe_checkout_session_id = '${session.id}'`
    );
  } catch (error) {
    console.error("Error handling checkout session expired:", error);
  }
}
