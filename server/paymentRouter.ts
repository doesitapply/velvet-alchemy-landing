import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { WEBSITE_PACKAGES, PackageType } from "./products";
import Stripe from "stripe";
import { ENV } from "./_core/env";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  });
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
      const { leadId, packageType } = input;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Get lead details
      const leadData = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

      if (!leadData || leadData.length === 0) {
        throw new Error("Lead not found");
      }

      const lead = leadData[0];
      const packageInfo = WEBSITE_PACKAGES[packageType as PackageType];

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
        success_url: `${ctx.req.headers.origin}/leads/${leadId}?payment=success`,
        cancel_url: `${ctx.req.headers.origin}/leads/${leadId}?payment=cancelled`,
        client_reference_id: leadId.toString(),
        customer_email: undefined, // Email not stored in leads table
        metadata: {
          lead_id: leadId.toString(),
          package_type: packageType,
          company_name: lead.companyName,
          user_id: ctx.user.id.toString(),
        },
        allow_promotion_codes: true,
      });

      // Store payment record in database
      await db.execute(
        `INSERT INTO payments (lead_id, stripe_checkout_session_id, amount, currency, status, package_type, payment_link)
         VALUES (${leadId}, '${session.id}', ${packageInfo.price}, '${packageInfo.currency}', 'pending', '${packageType}', '${session.url}')`
      );

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
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const [payments] = await db.execute(
        `SELECT * FROM payments WHERE lead_id = ${input.leadId} ORDER BY created_at DESC`
      ) as any;
      return payments;
    }),

  /**
   * Get all payments for the current user
   */
  getAllPayments: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const [payments] = await db.execute(
      `SELECT p.*, l.companyName, l.websiteUrl 
       FROM payments p
       JOIN leads l ON p.lead_id = l.id
       WHERE l.userId = ${ctx.user.id}
       ORDER BY p.created_at DESC`
    ) as any;
    return payments;
  }),
});
