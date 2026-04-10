import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/app-config";
import { notifyRestaurantBigDayEscalation } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threshold = await appConfig.bigDayOrderThreshold();

    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    tomorrowStart.setUTCHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    const tomorrowOrders = await prisma.order.findMany({
      where: {
        status: { in: ["SCHEDULED", "RELEASED"] },
        isScheduled: true,
        scheduledFor: { gte: tomorrowStart, lte: tomorrowEnd },
      },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { scheduledFor: "asc" },
    });

    if (tomorrowOrders.length < threshold) {
      return Response.json({ ok: true, bigDay: false, orderCount: tomorrowOrders.length });
    }

    // Only escalate if NOT yet acknowledged
    const ack = await prisma.bigDayAck.findUnique({ where: { date: tomorrowStart } });
    if (ack) {
      return Response.json({ ok: true, bigDay: true, alreadyAcked: true, escalated: false });
    }

    // Compute total items for the summary
    let totalItems = 0;
    for (const order of tomorrowOrders) {
      for (const item of order.items) totalItems += item.quantity;
    }

    await notifyRestaurantBigDayEscalation({
      date: tomorrowStart,
      orderCount: tomorrowOrders.length,
      totalItems,
      orders: tomorrowOrders.map((o) => ({
        orderNumber: o.orderNumber,
        scheduledFor: o.scheduledFor!,
        totalAmountCents: o.totalAmountCents,
        items: o.items.map((i) => ({ quantity: i.quantity, product: { name: i.product.name } })),
      })),
    });

    console.log(`[cron/big-day-escalation] Sent escalation for ${tomorrowStart.toISOString().slice(0, 10)}`);
    return Response.json({ ok: true, bigDay: true, escalated: true, orderCount: tomorrowOrders.length });
  } catch (error) {
    console.error("[cron/big-day-escalation] Failed:", error);
    return Response.json({ error: "Cron job failed" }, { status: 500 });
  }
}
