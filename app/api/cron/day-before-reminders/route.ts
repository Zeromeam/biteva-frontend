import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/app-config";
import { notifyRestaurantBigDay } from "@/lib/notifications";

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
    const [enabled, threshold] = await Promise.all([
      appConfig.dayBeforeReminderEnabled(),
      appConfig.bigDayOrderThreshold(),
    ]);

    if (!enabled) {
      return Response.json({ ok: true, skipped: true, reason: "day_before_reminder_enabled is false" });
    }

    // Compute tomorrow's date range (start of day to end of day UTC)
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    tomorrowStart.setUTCHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    // Find all scheduled orders for tomorrow
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

    // Compute total item quantity across all tomorrow's orders
    let totalItems = 0;
    for (const order of tomorrowOrders) {
      for (const item of order.items) totalItems += item.quantity;
    }

    if (totalItems < threshold) {
      return Response.json({ ok: true, totalItems, bigDay: false });
    }

    // Check if already acknowledged
    const ack = await prisma.bigDayAck.findUnique({ where: { date: tomorrowStart } });
    if (ack) {
      return Response.json({ ok: true, bigDay: true, alreadyAcked: true });
    }

    // Send big day alert
    await notifyRestaurantBigDay({
      date: tomorrowStart,
      orderCount: tomorrowOrders.length,
      orders: tomorrowOrders.map((o) => ({
        orderNumber: o.orderNumber,
        scheduledFor: o.scheduledFor!,
        totalAmountCents: o.totalAmountCents,
        items: o.items.map((i) => ({ quantity: i.quantity, product: { name: i.product.name } })),
      })),
    });

    console.log(`[cron/day-before-reminders] Sent big-day alert for ${tomorrowStart.toISOString().slice(0, 10)} (${totalItems} items across ${tomorrowOrders.length} orders)`);
    return Response.json({ ok: true, bigDay: true, totalItems, orderCount: tomorrowOrders.length, notified: true });
  } catch (error) {
    console.error("[cron/day-before-reminders] Failed:", error);
    return Response.json({ error: "Cron job failed" }, { status: 500 });
  }
}
