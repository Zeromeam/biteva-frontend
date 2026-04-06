import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { products as staticProducts } from "@/lib/order-cart";

const schema = z.object({
  stockCount: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const staticProduct = staticProducts.find((p) => p.id === slug);
  if (!staticProduct) {
    return NextResponse.json({ ok: false, error: "Unknown product." }, { status: 404 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  // Upsert so the admin can set stock before the first order ever arrives
  const product = await prisma.product.upsert({
    where: { slug },
    update: parsed.data,
    create: {
      name: staticProduct.name,
      slug,
      priceCents: Math.round(staticProduct.price * 100),
      active: true,
      stockCount: parsed.data.stockCount ?? 0,
      lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
    },
    select: { slug: true, stockCount: true, lowStockThreshold: true },
  });

  return NextResponse.json({ ok: true, product });
}
