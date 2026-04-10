import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/app-config";
import { notifyRestaurantOrderReleased } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in dev if not set
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const releaseWindowHours = await appConfig.releaseWindowHours();
    const releaseThreshold = new Date(Date.now() + releaseWindowHours * 60 * 60 * 1000);

    // Find all SCHEDULED orders that are due within the release window
    const ordersToRelease = await prisma.order.findMany({
      where: {
        status: "SCHEDULED",
        isScheduled: true,
        scheduledFor: { lte: releaseThreshold },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    if (ordersToRelease.length === 0) {
      return Response.json({ ok: true, released: 0 });
    }

    const now = new Date();

    // Release each order atomically with audit trail
    await Promise.all(
      ordersToRelease.map((order) =>
        prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data: { status: "RELEASED", releasedAt: now },
          }),
          prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: "SCHEDULED",
              toStatus: "RELEASED",
              changedBy: "cron",
              note: `Auto-released ${releaseWindowHours}h before scheduled delivery`,
            },
          }),
        ])
      )
    );

    // Send release notification emails (best-effort)
    await Promise.all(
      ordersToRelease.map((order) => {
        if (!order.scheduledFor) return Promise.resolve();
        return notifyRestaurantOrderReleased({
          id: order.id,
          orderNumber: order.orderNumber,
          scheduledFor: order.scheduledFor,
          totalAmountCents: order.totalAmountCents,
          shippingFullName: order.shippingFullName,
          shippingPhone: order.shippingPhone,
          shippingAddressLine1: order.shippingAddressLine1,
          shippingCity: order.shippingCity,
          deliveryMode: order.deliveryMode,
          deliveryLat: order.deliveryLat,
          deliveryLng: order.deliveryLng,
          items: order.items.map((i) => ({
            quantity: i.quantity,
            product: { name: i.product.name },
          })),
        }).catch((err) => console.error(`Release notification failed for ${order.orderNumber}:`, err));
      })
    );

    console.log(`[cron/release-scheduled-orders] Released ${ordersToRelease.length} orders`);
    return Response.json({ ok: true, released: ordersToRelease.length });
  } catch (error) {
    console.error("[cron/release-scheduled-orders] Failed:", error);
    return Response.json({ error: "Cron job failed" }, { status: 500 });
  }
}
