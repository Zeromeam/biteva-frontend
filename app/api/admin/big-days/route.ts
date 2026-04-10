import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

// Returns upcoming big days (days with total item quantity >= threshold) + their ack status
export async function GET() {
  try {
    const threshold = await appConfig.bigDayOrderThreshold();

    const now = new Date();
    const lookAheadEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all scheduled orders in the next 30 days
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ["SCHEDULED", "RELEASED"] },
        isScheduled: true,
        scheduledFor: { gte: now, lte: lookAheadEnd },
      },
      select: {
        orderNumber: true,
        scheduledFor: true,
        totalAmountCents: true,
        items: {
          select: {
            quantity: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
    });

    // Group by calendar date (using local date string as key)
    type DayGroup = {
      date: Date;
      dateKey: string;
      orderCount: number;
      totalItems: number;
      topItems: Array<{ name: string; quantity: number }>;
      orders: Array<{
        orderNumber: string;
        scheduledFor: Date;
        totalAmountCents: number;
      }>;
    };

    const dayMap = new Map<string, DayGroup>();

    for (const order of orders) {
      if (!order.scheduledFor) continue;
      const d = order.scheduledFor;
      // Normalize to start-of-day UTC to match BigDayAck.date
      const dayStart = new Date(d);
      dayStart.setUTCHours(0, 0, 0, 0);
      const key = dayStart.toISOString();

      if (!dayMap.has(key)) {
        dayMap.set(key, {
          date: dayStart,
          dateKey: key,
          orderCount: 0,
          totalItems: 0,
          topItems: [],
          orders: [],
        });
      }

      const group = dayMap.get(key)!;
      group.orderCount += 1;
      group.orders.push({
        orderNumber: order.orderNumber,
        scheduledFor: order.scheduledFor,
        totalAmountCents: order.totalAmountCents,
      });

      for (const item of order.items) {
        group.totalItems += item.quantity;
        const existing = group.topItems.find((t) => t.name === item.product.name);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          group.topItems.push({ name: item.product.name, quantity: item.quantity });
        }
      }
    }

    // Filter to only big days (total item quantity >= threshold) and sort topItems
    const bigDayDates: Date[] = [];
    const bigDays = [...dayMap.values()]
      .filter((g) => g.totalItems >= threshold)
      .map((g) => {
        bigDayDates.push(g.date);
        return {
          ...g,
          topItems: g.topItems.sort((a, b) => b.quantity - a.quantity).slice(0, 5),
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Fetch ack status for all big days
    const acks = bigDayDates.length > 0
      ? await prisma.bigDayAck.findMany({ where: { date: { in: bigDayDates } } })
      : [];
    const ackedDates = new Set(acks.map((a) => a.date.toISOString()));

    const result = bigDays.map((day) => ({
      date: day.date,
      orderCount: day.orderCount,
      totalItems: day.totalItems,
      topItems: day.topItems,
      orders: day.orders,
      isAcked: ackedDates.has(day.date.toISOString()),
      ackedAt: acks.find((a) => a.date.toISOString() === day.date.toISOString())?.ackedAt ?? null,
    }));

    return Response.json({ ok: true, bigDays: result, threshold });
  } catch (error) {
    console.error("GET /api/admin/big-days failed:", error);
    return Response.json({ error: "Failed to load big days." }, { status: 500 });
  }
}
