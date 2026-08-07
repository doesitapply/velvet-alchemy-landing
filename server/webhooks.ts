import express, { Express, Request, Response } from "express";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { leads, payments, type Payment } from "../drizzle/schema";
import { getDb } from "./db";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  });
}

type CheckoutBinding = Pick<
  Stripe.Checkout.Session,
  | "id"
  | "mode"
  | "payment_status"
  | "amount_total"
  | "currency"
  | "client_reference_id"
  | "metadata"
  | "payment_intent"
>;

function paymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"]
): string | null {
  if (typeof paymentIntent === "string") return paymentIntent;
  return paymentIntent?.id ?? null;
}

export function validateCheckoutBinding(
  session: CheckoutBinding,
  payment: Payment
): { paymentIntentId: string } {
  const intentId = paymentIntentId(session.payment_intent);
  const metadata = session.metadata ?? {};
  if (session.mode !== "payment") {
    throw new Error("Checkout session is not a one-time payment.");
  }
  if (session.payment_status !== "paid") {
    throw new Error("Checkout session is not paid.");
  }
  if (!intentId) {
    throw new Error("Checkout session has no payment intent.");
  }
  if (session.amount_total !== payment.amount) {
    throw new Error("Checkout amount does not match the stored payment.");
  }
  if (session.currency?.toLowerCase() !== payment.currency.toLowerCase()) {
    throw new Error("Checkout currency does not match the stored payment.");
  }
  if (session.client_reference_id !== String(payment.lead_id)) {
    throw new Error(
      "Checkout client reference does not match the stored lead."
    );
  }
  if (metadata.lead_id !== String(payment.lead_id)) {
    throw new Error(
      "Checkout metadata lead does not match the stored payment."
    );
  }
  if (metadata.package_type !== payment.package_type) {
    throw new Error("Checkout package does not match the stored payment.");
  }
  return { paymentIntentId: intentId };
}

async function ensureLeadPaid(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  leadId: number
): Promise<void> {
  await db
    .update(leads)
    .set({ status: "paid", updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  const [lead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (lead?.status !== "paid") {
    throw new Error(
      "Payment completed but the expected lead was not marked paid."
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<"COMPLETED" | "DUPLICATE"> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable during checkout fulfillment.");
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripe_checkout_session_id, session.id))
    .limit(1);
  if (!payment) {
    throw new Error("No stored payment matches the checkout session.");
  }

  const binding = validateCheckoutBinding(session, payment);
  if (payment.status === "completed") {
    if (
      payment.stripe_payment_intent_id &&
      payment.stripe_payment_intent_id !== binding.paymentIntentId
    ) {
      throw new Error("Completed payment intent does not match this event.");
    }
    await ensureLeadPaid(db, payment.lead_id);
    return "DUPLICATE";
  }
  if (payment.status !== "pending") {
    throw new Error(`Payment cannot complete from status ${payment.status}.`);
  }

  const update = await db
    .update(payments)
    .set({
      status: "completed",
      paid_at: new Date(),
      stripe_payment_intent_id: binding.paymentIntentId,
    })
    .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
  if (Number(update[0]?.affectedRows ?? 0) !== 1) {
    const [current] = await db
      .select({
        status: payments.status,
        paymentIntentId: payments.stripe_payment_intent_id,
      })
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    if (
      current?.status === "completed" &&
      current.paymentIntentId === binding.paymentIntentId
    ) {
      await ensureLeadPaid(db, payment.lead_id);
      return "DUPLICATE";
    }
    throw new Error("Expected payment row was not updated.");
  }

  await ensureLeadPaid(db, payment.lead_id);

  return "COMPLETED";
}

async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session
): Promise<"EXPIRED" | "DUPLICATE"> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable during checkout expiration.");
  }
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripe_checkout_session_id, session.id))
    .limit(1);
  if (!payment) {
    throw new Error("No stored payment matches the expired checkout session.");
  }
  if (payment.status === "expired") return "DUPLICATE";
  if (payment.status !== "pending") {
    throw new Error(`Payment cannot expire from status ${payment.status}.`);
  }

  const update = await db
    .update(payments)
    .set({ status: "expired" })
    .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
  if (Number(update[0]?.affectedRows ?? 0) !== 1) {
    throw new Error("Expected payment row was not expired.");
  }
  return "EXPIRED";
}

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).send("Missing Stripe signature.");
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(503).send("Stripe webhook is not configured.");
      }

      let event: Stripe.Event;
      try {
        event = getStripe().webhooks.constructEvent(
          req.body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch {
        return res.status(400).send("Invalid Stripe signature.");
      }

      try {
        let state = "IGNORED";
        if (event.type === "checkout.session.completed") {
          state = await handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
        } else if (event.type === "checkout.session.expired") {
          state = await handleCheckoutSessionExpired(
            event.data.object as Stripe.Checkout.Session
          );
        }
        return res.json({ received: true, state });
      } catch (error) {
        console.error("[StripeWebhook] Event processing failed:", error);
        return res.status(500).json({
          received: false,
          error: "Stripe event was not persisted and should be retried.",
        });
      }
    }
  );
}
