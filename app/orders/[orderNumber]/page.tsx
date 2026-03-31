import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCentsAsEuro } from "@/lib/money";

type PageProps = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export default async function OrderReceiptPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
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
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Internal receipt</p>
            <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
          </div>

          <div className="text-sm">
            <div>Status: {order.status}</div>
            <div>Created: {order.createdAt.toLocaleString("en-AT")}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Customer
            </h2>
            <div className="mt-2 text-sm">
              <div>{order.customer.fullName}</div>
              <div>{order.customer.email}</div>
              {order.customer.phone ? <div>{order.customer.phone}</div> : null}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Summary
            </h2>
            <div className="mt-2 text-sm">
              <div>Currency: {order.currency}</div>
              <div>Total: {formatCentsAsEuro(order.totalAmountCents)}</div>
            </div>
          </section>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">{item.product.name}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">
                    {formatCentsAsEuro(item.unitPriceCents)}
                  </td>
                  <td className="px-4 py-3">
                    {formatCentsAsEuro(item.lineTotalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
