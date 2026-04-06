import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { products as staticProducts } from "@/lib/order-cart";

export const dynamic = "force-dynamic";

// Returns all known products with their current stock counts.
// Products not yet in the DB are included with stockCount: 0.
export async function GET() {
  const dbProducts = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true, stockCount: true, lowStockThreshold: true },
  });

  const dbMap = new Map(dbProducts.map((p) => [p.slug, p]));

  const products = staticProducts.map((p) => {
    const db = dbMap.get(p.id);
    return {
      slug: p.id,
      name: p.name,
      stockCount: db?.stockCount ?? 0,
      lowStockThreshold: db?.lowStockThreshold ?? 5,
    };
  });

  return NextResponse.json({ ok: true, products });
}
