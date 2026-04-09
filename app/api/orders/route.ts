import { z } from "zod";
import { type NextRequest } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { makeOrderNumber } from "@/lib/order-number";
import { getResend } from "@/lib/resend";
import { buildReceiptEmail } from "@/lib/email/receipt";

export const dynamic = "force-dynamic";

// ── GET (unchanged) ──────────────────────────────────────────────────────

const ORDER_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function isOrderStatus(value: string): value is (typeof ORDER_STATUSES)[number] {
  return ORDER_STATUSES.includes(value as (typeof ORDER_STATUSES)[number]);
}

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  totalAmountCents: number;
  deliveryMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  shippingFullName: string | null;
  shippingEmail: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { fullName: string; email: string; phone: string | null };
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    product: { name: string; slug: string };
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    totalAmountCents: order.totalAmountCents,
    deliveryMode: order.deliveryMode ?? "address",
    deliveryLat: order.deliveryLat,
    deliveryLng: order.deliveryLng,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: {
      fullName: order.customer.fullName,
      email: order.customer.email,
      phone: order.customer.phone,
    },
    shipping: {
      fullName: order.shippingFullName,
      email: order.shippingEmail,
      phone: order.shippingPhone,
      addressLine1: order.shippingAddressLine1,
      addressLine2: order.shippingAddressLine2,
      city: order.shippingCity,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      productSlug: item.product.slug,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() ?? "";
    const statusParam = searchParams.get("status")?.trim().toUpperCase() ?? "";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const requestedPageSize = Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize));

    const filters: Prisma.OrderWhereInput[] = [];

    if (statusParam && statusParam !== "ALL") {
      if (!isOrderStatus(statusParam)) {
        return Response.json({ error: "Invalid order status filter." }, { status: 400 });
      }
      filters.push({ status: statusParam });
    }

    if (query) {
      filters.push({
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customer: { is: { fullName: { contains: query, mode: "insensitive" } } } },
          { customer: { is: { email: { contains: query, mode: "insensitive" } } } },
          { shippingCity: { contains: query, mode: "insensitive" } },
          { shippingPostalCode: { contains: query, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.OrderWhereInput = filters.length > 0 ? { AND: filters } : {};

    const [totalCount, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return Response.json({
      ok: true,
      orders: orders.map(serializeOrder),
      pagination: {
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
        totalCount,
      },
    });
  } catch (error) {
    console.error("GET /api/orders failed", error);
    return Response.json({ error: "Something went wrong while loading orders." }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.number(),
  totalPrice: z.number(),
  side: z.string().nullable().optional(),
  sauces: z.array(z.string()).optional(),
  drink: z.string().nullable().optional(),
});

const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1, "Cart is empty"),
  deliveryMode: z.enum(["address", "gps"]).default("address"),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  customer: z.object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z.string().trim().optional(),
    phone: z.string().trim().min(1, "Phone is required"),
    address: z.string().trim().optional(),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    country: z.string().trim().default("AT"),
    note: z.string().optional(),
  }),
  subtotal: z.number(),
  stripePaymentIntentId: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.deliveryMode === "address") {
    if (!val.customer.address?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Address is required", path: ["customer", "address"] });
    }
    if (!val.customer.city?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "City is required", path: ["customer", "city"] });
    }
    if (!val.customer.postalCode?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Postal code is required", path: ["customer", "postalCode"] });
    }
  } else {
    if (!val.deliveryLat || !val.deliveryLng) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GPS coordinates are required for GPS delivery", path: ["deliveryLat"] });
    }
  }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    // ── Stock check ───────────────────────────────────────────────────────
    const slugs = data.items.map((i) => i.productId);
    const stockRows = await prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, stockCount: true },
    });
    const stockMap = new Map(stockRows.map((p) => [p.slug, p.stockCount]));

    for (const item of data.items) {
      const available = stockMap.get(item.productId) ?? 0;
      if (item.quantity > available) {
        return Response.json(
          { error: `Not enough stock for "${item.productName}". Only ${available} left.` },
          { status: 409 }
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Derive a stable guest email from phone number
    const digits = data.customer.phone.replace(/\D/g, "");
    const guestEmail = `${digits}@guest.biteva.com`;

    const totalAmountCents = Math.round(data.subtotal * 100);

    // Upsert customer
    const customer = await prisma.customer.upsert({
      where: { email: guestEmail },
      update: { fullName: data.customer.fullName, phone: data.customer.phone },
      create: { fullName: data.customer.fullName, email: guestEmail, phone: data.customer.phone },
    });

    // Upsert each product by slug (productId doubles as slug)
    const dbProductIds: Record<string, string> = {};
    for (const item of data.items) {
      const product = await prisma.product.upsert({
        where: { slug: item.productId },
        update: { name: item.productName },
        create: {
          name: item.productName,
          slug: item.productId,
          priceCents: Math.round(item.unitPrice * 100),
          active: true,
        },
      });
      dbProductIds[item.productId] = product.id;
    }

    // Generate a unique order number
    let orderNumber = makeOrderNumber();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
      if (!existing) break;
      orderNumber = makeOrderNumber();
    }

    // ── Create order + decrement stock atomically ─────────────────────────
    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          orderNumber,
          status: data.stripePaymentIntentId ? "PAID" : "PENDING",
          currency: "EUR",
          totalAmountCents,
          customerId: customer.id,
          deliveryMode: data.deliveryMode,
          deliveryLat: data.deliveryLat ?? null,
          deliveryLng: data.deliveryLng ?? null,
          shippingFullName: data.customer.fullName,
          shippingEmail: data.customer.email ?? null,
          shippingPhone: data.customer.phone,
          shippingAddressLine1: data.customer.address ?? null,
          shippingAddressLine2: data.customer.addressLine2 ?? null,
          shippingCity: data.customer.city ?? null,
          shippingPostalCode: data.customer.postalCode ?? null,
          shippingCountry: data.customer.country,
          stripePaymentIntentId: data.stripePaymentIntentId ?? null,
          items: {
            create: data.items.map((item) => ({
              productId: dbProductIds[item.productId],
              quantity: item.quantity,
              unitPriceCents: Math.round(item.unitPrice * 100),
              lineTotalCents: Math.round(item.totalPrice * 100),
            })),
          },
        },
        select: { orderNumber: true },
      }),
      ...data.items.map((item) =>
        prisma.product.update({
          where: { slug: item.productId },
          data: { stockCount: { decrement: item.quantity } },
        })
      ),
    ]);
    // ─────────────────────────────────────────────────────────────────────

    // ── Send receipt email (best-effort — never fails the order) ─────────
    if (data.customer.email) {
      try {
        const fullOrder = await prisma.order.findUnique({
          where: { orderNumber: order.orderNumber },
          include: { items: { include: { product: true } } },
        });

        if (fullOrder) {
          const receiptUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/orders/${order.orderNumber}`;
          const { subject, html } = buildReceiptEmail(fullOrder, receiptUrl);
          await getResend().emails.send({
            from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
            to: data.customer.email,
            subject,
            html,
          });
        }
      } catch (emailError) {
        console.error("Receipt email failed (order still created):", emailError);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    return Response.json({ ok: true, orderNumber: order.orderNumber }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders failed", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    return Response.json({ error: "Could not create your order." }, { status: 500 });
  }
}
