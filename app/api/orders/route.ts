import { z } from "zod";
import { type NextRequest } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { makeOrderNumber } from "@/lib/order-number";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const createOrderSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is too short"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().optional().or(z.literal("")),
  productSlug: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
  addressLine1: z.string().trim().min(3, "Address line 1 is too short"),
  addressLine2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is too short"),
  postalCode: z.string().trim().min(2, "Postal code is too short"),
  country: z.string().trim().min(2, "Country is too short"),
});

function isOrderStatus(value: string): value is (typeof ORDER_STATUSES)[number] {
  return ORDER_STATUSES.includes(value as (typeof ORDER_STATUSES)[number]);
}

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  totalAmountCents: number;
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
  customer: {
    fullName: string;
    email: string;
    phone: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    product: {
      name: string;
      slug: string;
    };
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    totalAmountCents: order.totalAmountCents,
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
          {
            orderNumber: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            customer: {
              is: {
                fullName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            customer: {
              is: {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            shippingCity: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            shippingPostalCode: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      });
    }

    const where: Prisma.OrderWhereInput = filters.length > 0 ? { AND: filters } : {};

    const [totalCount, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
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

    return Response.json(
      { error: "Something went wrong while loading orders." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    const product = await prisma.product.findUnique({
      where: { slug: data.productSlug },
    });

    if (!product || !product.active) {
      return Response.json(
        { error: "Product not found or inactive." },
        { status: 404 }
      );
    }

    const totalAmountCents = product.priceCents * data.quantity;

    const customer = await prisma.customer.upsert({
      where: { email: data.email },
      update: {
        fullName: data.fullName,
        phone: data.phone || null,
      },
      create: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
      },
    });

    let orderNumber = makeOrderNumber();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      orderNumber = makeOrderNumber();
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: "PENDING",
        currency: "EUR",
        totalAmountCents,
        customerId: customer.id,
        shippingFullName: data.fullName,
        shippingEmail: data.email,
        shippingPhone: data.phone || null,
        shippingAddressLine1: data.addressLine1,
        shippingAddressLine2: data.addressLine2 || null,
        shippingCity: data.city,
        shippingPostalCode: data.postalCode,
        shippingCountry: data.country,
        items: {
          create: [
            {
              productId: product.id,
              quantity: data.quantity,
              unitPriceCents: product.priceCents,
              lineTotalCents: totalAmountCents,
            },
          ],
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return Response.json(
      {
        ok: true,
        order: serializeOrder(order),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/orders failed", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Validation failed",
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Something went wrong while creating the order." },
      { status: 500 }
    );
  }
}
