import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  product: {
    findUnique: vi.fn(),
  },
  customer: {
    upsert: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

const mockOrderNumber = vi.hoisted(() => vi.fn(() => "BTV-20260331-ABC123"));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/order-number", () => ({
  makeOrderNumber: mockOrderNumber,
}));

import { POST } from "@/app/api/orders/route";

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an order from the existing backend pieces", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "prod_1",
      slug: "biteva-box",
      name: "Biteva Box",
      priceCents: 3990,
      active: true,
    });

    mockPrisma.customer.upsert.mockResolvedValue({
      id: "cust_1",
      fullName: "Mo Ali",
      email: "mo@example.com",
      phone: "+431234567",
    });

    mockPrisma.order.findUnique.mockResolvedValue(null);

    mockPrisma.order.create.mockResolvedValue({
      id: "order_1",
      orderNumber: "BTV-20260331-ABC123",
      status: "PENDING",
      totalAmountCents: 7980,
      currency: "EUR",
      customer: {
        fullName: "Mo Ali",
        email: "mo@example.com",
        phone: "+431234567",
      },
      items: [
        {
          id: "item_1",
          quantity: 2,
          unitPriceCents: 3990,
          lineTotalCents: 7980,
          product: {
            name: "Biteva Box",
          },
        },
      ],
    });

    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Mo Ali",
        email: "mo@example.com",
        phone: "+431234567",
        productSlug: "biteva-box",
        quantity: 2,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
      where: { slug: "biteva-box" },
    });
    expect(mockPrisma.customer.upsert).toHaveBeenCalled();
    expect(mockPrisma.order.create).toHaveBeenCalled();
    expect(data.ok).toBe(true);
    expect(data.order.orderNumber).toBe("BTV-20260331-ABC123");
    expect(data.order.totalAmountCents).toBe(7980);
  });
});
