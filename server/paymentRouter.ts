import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { createPaymentRecord, getLeadById, getPaymentsByLeadId, getPaymentsByUserId } from "./db";
import { WEBSITE_PACKAGES, PackageType } from "./products";
import Stripe from "stripe";
import { ENV } from "./_core/env";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-01-28.clover",
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

      // Get lead details
      const lead = await getLeadById(leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

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
      await createPaymentRecord({
        lead_id: leadId,
        stripe_checkout_session_id: session.id,
        amount: packageInfo.price,
        currency: packageInfo.currency,
        status: "pending",
        package_type: packageType,
        payment_link: session.url || undefined,
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
    .query(async ({ input }) => {
      return await getPaymentsByLeadId(input.leadId);
    }),

  /**
   * Get all payments for the current user
   */
  getAllPayments: protectedProcedure.query(async ({ ctx }) => {
    return await getPaymentsByUserId(ctx.user.id);
  }),
});
