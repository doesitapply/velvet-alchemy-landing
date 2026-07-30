import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, payments } from "../drizzle/schema";
import { WEBSITE_PACKAGES, PackageType } from "./products";
import Stripe from "stripe";
import { checkKillSwitch, checkRateLimit } from "./governor";
import { requireCostAuthority, requireOwnedLead } from "./lib/accessControl";
import { desc, eq } from "drizzle-orm";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  });
}

function getCheckoutOrigin(rawOrigin: unknown): string {
  if (typeof rawOrigin !== "string") {
    throw new Error("A valid request origin is required.");
  }
  const origin = new URL(rawOrigin);
  const local =
    origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  if (origin.protocol !== "https:" && !(local && origin.protocol === "http:")) {
    throw new Error(
      "Checkout redirects require HTTPS or a local development origin."
    );
  }
  return origin.origin;
}

export const paymentRouter = router({
  /**
   * Create a Stripe Checkout session for website payment
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        packageType: z.enum(["basic", "standard", "premium"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireCostAuthority(ctx.user);
      const { leadId, packageType } = input;
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "checkout_create");
      const lead = await requireOwnedLead(leadId, ctx.user);
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const packageInfo = WEBSITE_PACKAGES[packageType as PackageType];
      const checkoutOrigin = getCheckoutOrigin(ctx.req.headers.origin);

      // Create Stripe Checkout Session
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: packageInfo.currency,
              product_data: {
                name: packageInfo.name,
                description: packageInfo.description,
              },
              unit_amount: packageInfo.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${checkoutOrigin}/leads/${leadId}?payment=success`,
        cancel_url: `${checkoutOrigin}/leads/${leadId}?payment=cancelled`,
        client_reference_id: leadId.toString(),
        customer_email: undefined, // Email not stored in leads table
        metadata: {
          lead_id: leadId.toString(),
          package_type: packageType,
          company_name: lead.companyName,
          user_id: ctx.user.id.toString(),
        },
        allow_promotion_codes: false,
      });

      await db.insert(payments).values({
        lead_id: leadId,
        stripe_checkout_session_id: session.id,
        amount: packageInfo.price,
        currency: packageInfo.currency,
        status: "pending",
        package_type: packageType,
        payment_link: session.url,
      });

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    }),

  /**
   * Get payment history for a lead
   */
  getPaymentsByLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOwnedLead(input.leadId, ctx.user);
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      return db
        .select()
        .from(payments)
        .where(eq(payments.lead_id, input.leadId))
        .orderBy(desc(payments.created_at));
    }),

  /**
   * Get all payments for the current user
   */
  getAllPayments: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    return db
      .select({
        payment: payments,
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
      })
      .from(payments)
      .innerJoin(leads, eq(payments.lead_id, leads.id))
      .where(eq(leads.userId, ctx.user.id))
      .orderBy(desc(payments.created_at))
      .then(rows =>
        rows.map(({ payment, ...lead }) => ({ ...payment, ...lead }))
      );
  }),
});
