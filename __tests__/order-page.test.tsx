import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrderPage from "@/app/order/page";

describe("order page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the expected payload to the existing orders api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        order: {
          orderNumber: "BTV-20260331-ABC123",
          totalAmountCents: 7980,
          currency: "EUR",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<OrderPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Mo Ali" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "mo@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+431234567" },
    });
    fireEvent.change(screen.getByLabelText(/quantity/i), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Mo Ali",
        email: "mo@example.com",
        phone: "+431234567",
        quantity: 2,
        productSlug: "biteva-box",
      }),
    });

    expect(await screen.findByText(/order created/i)).toBeInTheDocument();
    expect(screen.getByText(/BTV-20260331-ABC123/i)).toBeInTheDocument();
  });
});
