import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCentsAsEuro } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: {
      createdAt: "desc",
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Admin orders</h1>
        <p className="text-sm text-gray-600">
          Use this page to confirm that your local order was saved.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3">Order number</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{order.orderNumber}</div>
                  <Link
                    href={`/orders/${order.orderNumber}`}
                    className="text-xs underline"
                  >
                    Open receipt
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{order.customer.fullName}</div>
                  <div className="text-xs text-gray-600">
                    {order.customer.email}
                  </div>
                </td>
                <td className="px-4 py-3">{order.status}</td>
                <td className="px-4 py-3">
                  {formatCentsAsEuro(order.totalAmountCents)}
                </td>
                <td className="px-4 py-3">
                  {order.createdAt.toLocaleString("en-AT")}
                </td>
              </tr>
            ))}

            {orders.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={5}>
                  No orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
