import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notifyRestaurantComplaint,
  notifyCustomerComplaintReceived,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["LATE_DELIVERY", "WRONG_ORDER", "QUALITY", "OTHER"] as const;
const VALID_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED"] as const;
const PAGE_SIZE = 20;

const createComplaintSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
  subject: z.string().min(1).max(120),
  message: z.string().min(1).max(1000),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  orderNumber: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { category, subject, message, name, email, phone, orderNumber: rawOrderNumber } = parsed.data;

  // Resolve orderNumber → orderId if provided
  let resolvedOrderId: string | null = null;
  let orderNumber: string | null = null;
  if (rawOrderNumber) {
    const order = await prisma.order.findUnique({
      where: { orderNumber: rawOrderNumber.trim() },
      select: { id: true, orderNumber: true },
    });
    if (order) {
      resolvedOrderId = order.id;
      orderNumber = order.orderNumber;
    } else {
      // Store the number as-is even if not found — don't silently drop it
      orderNumber = rawOrderNumber.trim();
    }
  }

  const complaint = await prisma.complaint.create({
    data: {
      category,
      subject,
      message,
      name,
      email,
      phone: phone ?? null,
      orderId: resolvedOrderId,
    },
  });

  const payload = {
    id: complaint.id,
    name,
    email,
    phone: phone ?? null,
    category,
    subject,
    message,
    orderNumber,
    createdAt: complaint.createdAt,
  };

  // Fire-and-forget — don't block response on email failures
  void notifyRestaurantComplaint(payload);
  void notifyCustomerComplaintReceived(payload);

  return NextResponse.json({ id: complaint.id }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status");
  const pageParam = searchParams.get("page");
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const where = statusParam && VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])
    ? { status: statusParam as (typeof VALID_STATUSES)[number] }
    : {};

  const [total, complaints] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  return NextResponse.json({
    complaints: complaints.map((c) => ({
      id: c.id,
      status: c.status,
      category: c.category,
      subject: c.subject,
      message: c.message,
      name: c.name,
      email: c.email,
      phone: c.phone,
      adminNote: c.adminNote,
      orderNumber: c.order?.orderNumber ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}
