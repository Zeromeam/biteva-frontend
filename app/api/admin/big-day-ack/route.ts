import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ackSchema = z.object({
  // ISO date string for the day being acknowledged (start-of-day UTC)
  date: z.string().datetime({ offset: true }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = ackSchema.parse(body);

    const date = new Date(data.date);
    date.setUTCHours(0, 0, 0, 0);
    const now = new Date();

    await prisma.bigDayAck.upsert({
      where: { date },
      update: { ackedAt: now },
      create: { date, ackedAt: now },
    });

    return Response.json({ ok: true, date, ackedAt: now });
  } catch (error) {
    console.error("POST /api/admin/big-day-ack failed:", error);

    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid date format." }, { status: 400 });
    }

    return Response.json({ error: "Failed to acknowledge big day." }, { status: 500 });
  }
}
