import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { makeOrderNumber } from "@/lib/order-number";

const createOrderSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is too short"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().optional().or(z.literal("")),
  productSlug: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
});

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

    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
      });

      if (!existing) break;
      orderNumber = makeOrderNumber();
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: "PENDING",
        currency: "EUR",
        totalAmountCents,
        customerId: customer.id,
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
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmountCents: order.totalAmountCents,
          currency: order.currency,
          customer: {
            fullName: order.customer.fullName,
            email: order.customer.email,
            phone: order.customer.phone,
          },
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
          })),
        },
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
