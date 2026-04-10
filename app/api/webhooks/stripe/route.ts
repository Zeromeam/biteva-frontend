import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.arrayBuffer();
  const rawBody = Buffer.from(body);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return Response.json({ error: "Webhook not configured." }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Find the order to determine if it's scheduled or ASAP
    const order = await prisma.order.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: { id: true, status: true, isScheduled: true },
    });

    if (order && order.status === "PENDING") {
      // Scheduled orders → SCHEDULED, ASAP orders → PAID
      const newStatus = order.isScheduled ? "SCHEDULED" : "PAID";

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { status: newStatus },
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: "PENDING",
            toStatus: newStatus,
            changedBy: "stripe_webhook",
            note: `Payment confirmed: ${paymentIntent.id}`,
          },
        }),
      ]);
    }
  }

  return Response.json({ received: true });
}
