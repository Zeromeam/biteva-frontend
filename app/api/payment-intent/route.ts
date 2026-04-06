import { z } from "zod";
import { stripe } from "@/lib/stripe";

const schema = z.object({
  amountCents: z.number().int().min(1),
  currency: z.string().min(1),
  // When true: card-only PI (no Stripe Link, no local methods).
  // When false: automatic methods (Apple Pay / Google Pay enabled).
  cardOnly: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amountCents, currency, cardOnly } = schema.parse(body);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      ...(cardOnly
        ? { payment_method_types: ["card"] }
        : { automatic_payment_methods: { enabled: true } }),
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("POST /api/payment-intent failed", error);

    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    return Response.json({ error: "Could not create payment." }, { status: 500 });
  }
}
