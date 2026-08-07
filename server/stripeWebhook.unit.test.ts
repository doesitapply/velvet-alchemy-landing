import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import type { Payment } from "../drizzle/schema";
import { validateCheckoutBinding } from "./webhooks";

const payment = {
  id: 1,
  lead_id: 42,
  stripe_checkout_session_id: "cs_test_synthetic",
  stripe_payment_intent_id: null,
  amount: 500_000,
  currency: "usd",
  status: "pending",
  package_type: "standard",
  payment_link: null,
  created_at: new Date(),
  paid_at: null,
} satisfies Payment;

function session(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Pick<
  Stripe.Checkout.Session,
  | "id"
  | "mode"
  | "payment_status"
  | "amount_total"
  | "currency"
  | "client_reference_id"
  | "metadata"
  | "payment_intent"
> {
  return {
    id: "cs_test_synthetic",
    mode: "payment",
    payment_status: "paid",
    amount_total: 500_000,
    currency: "usd",
    client_reference_id: "42",
    metadata: {
      lead_id: "42",
      package_type: "standard",
    },
    payment_intent: "pi_test_synthetic",
    ...overrides,
  };
}

describe("Stripe checkout fulfillment binding", () => {
  it("accepts an exactly bound paid checkout", () => {
    expect(validateCheckoutBinding(session(), payment)).toEqual({
      paymentIntentId: "pi_test_synthetic",
    });
  });

  it.each([
    [{ amount_total: 499_999 }, /amount/i],
    [{ currency: "cad" }, /currency/i],
    [{ client_reference_id: "43" }, /client reference/i],
    [
      { metadata: { lead_id: "43", package_type: "standard" } },
      /metadata lead/i,
    ],
    [{ metadata: { lead_id: "42", package_type: "premium" } }, /package/i],
    [{ payment_status: "unpaid" }, /not paid/i],
    [{ payment_intent: null }, /no payment intent/i],
  ] as const)("rejects a mismatched checkout %#", (overrides, expected) => {
    expect(() =>
      validateCheckoutBinding(
        session(overrides as Partial<Stripe.Checkout.Session>),
        payment
      )
    ).toThrow(expected);
  });
});
