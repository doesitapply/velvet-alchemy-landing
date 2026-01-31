import express, { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getPaymentBySessionId, updatePaymentBySessionId, updateLead } from "./db";

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
    "/api/stripe/webhook",
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

      // Handle test events from Stripe CLI
      if (event.id.startsWith('evt_test_')) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
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

  try {
    // Update payment status to 'completed'
    await updatePaymentBySessionId(session.id, {
      status: "completed",
      paid_at: new Date(),
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    });

    const payment = await getPaymentBySessionId(session.id);
    if (payment) {
      await updateLead(payment.lead_id, { status: "paid" });
      console.log(`Lead ${payment.lead_id} marked as paid`);
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

  try {
    // Update payment status to 'expired'
    await updatePaymentBySessionId(session.id, { status: "expired" });
  } catch (error) {
    console.error("Error handling checkout session expired:", error);
  }
}
