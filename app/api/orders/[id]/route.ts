import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const updateOrderSchema = z.object({
  status: z.enum(["PENDING", "PAID", "CANCELLED"]),
});

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    return Response.json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    console.error("GET /api/orders/[id] failed", error);

    return Response.json(
      { error: "Something went wrong while loading the order." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateOrderSchema.parse(body);

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        items: { select: { quantity: true, product: { select: { slug: true } } } },
      },
    });

    if (!existingOrder) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    const wasCancelled = existingOrder.status === "CANCELLED";
    const becomingCancelled = data.status === "CANCELLED" && !wasCancelled;
    const becomingUncancelled = wasCancelled && data.status !== "CANCELLED";

    const [order] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: data.status },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      }),
      // Restore stock when cancelled
      ...(becomingCancelled
        ? existingOrder.items.map((item) =>
            prisma.product.update({
              where: { slug: item.product.slug },
              data: { stockCount: { increment: item.quantity } },
            })
          )
        : []),
      // Re-reserve stock when moving back from cancelled
      ...(becomingUncancelled
        ? existingOrder.items.map((item) =>
            prisma.product.update({
              where: { slug: item.product.slug },
              data: { stockCount: { decrement: item.quantity } },
            })
          )
        : []),
    ]);

    return Response.json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    console.error("PATCH /api/orders/[id] failed", error);

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
      { error: "Something went wrong while updating the order." },
      { status: 500 }
    );
  }
}
