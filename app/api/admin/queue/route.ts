import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Shared order select shape used in all sections
const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  currency: true,
  totalAmountCents: true,
  scheduledFor: true,
  isScheduled: true,
  releasedAt: true,
  deliveryMode: true,
  deliveryLat: true,
  deliveryLng: true,
  shippingFullName: true,
  shippingPhone: true,
  shippingAddressLine1: true,
  shippingAddressLine2: true,
  shippingCity: true,
  shippingPostalCode: true,
  shippingCountry: true,
  customerNote: true,
  driverNote: true,
  restaurantNotifiedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { fullName: true, email: true, phone: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPriceCents: true,
      lineTotalCents: true,
      product: { select: { name: true, slug: true } },
    },
  },
} as const;

// Restaurant active queue — orders the kitchen needs to act on right now
export async function GET() {
  try {
    const now = new Date();

    // Today's start/end for "coming today" section
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Tomorrow's range
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Day after tomorrow (start) for "upcoming 2+ days"
    const dayAfterTomorrowStart = new Date(tomorrowStart);
    dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

    const [activeQueue, comingToday, tomorrow, upcoming] = await Promise.all([
      // Section 1: Active kitchen queue (released, confirmed, or out for delivery)
      prisma.order.findMany({
        where: {
          status: { in: ["RELEASED", "CONFIRMED", "OUT_FOR_DELIVERY"] },
        },
        select: ORDER_SELECT,
        orderBy: [
          { scheduledFor: "asc" },
          { createdAt: "asc" },
        ],
      }),

      // Section 2: Still scheduled for today but not yet released
      prisma.order.findMany({
        where: {
          status: "SCHEDULED",
          isScheduled: true,
          scheduledFor: { gte: now, lte: todayEnd },
        },
        select: ORDER_SELECT,
        orderBy: { scheduledFor: "asc" },
      }),

      // Section 3: Tomorrow's scheduled orders
      prisma.order.findMany({
        where: {
          status: "SCHEDULED",
          isScheduled: true,
          scheduledFor: { gte: tomorrowStart, lte: tomorrowEnd },
        },
        select: ORDER_SELECT,
        orderBy: { scheduledFor: "asc" },
      }),

      // Section 4: Upcoming (2+ days from now)
      prisma.order.findMany({
        where: {
          status: "SCHEDULED",
          isScheduled: true,
          scheduledFor: { gte: dayAfterTomorrowStart },
        },
        select: ORDER_SELECT,
        orderBy: { scheduledFor: "asc" },
      }),
    ]);

    return Response.json({
      ok: true,
      activeQueue,
      comingToday,
      tomorrow,
      upcoming,
      counts: {
        activeQueue: activeQueue.length,
        comingToday: comingToday.length,
        tomorrow: tomorrow.length,
        upcoming: upcoming.length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/queue failed:", error);
    return Response.json({ error: "Failed to load kitchen queue." }, { status: 500 });
  }
}
