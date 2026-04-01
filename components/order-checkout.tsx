"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartItem,
  clearCart,
  CustomerDetails,
  formatMoney,
  getCartCount,
  getCartSubtotal,
  getItemUnitPrice,
  initialCustomerDetails,
  loadCart,
  removeCartItem,
  subscribeToCartUpdates,
  updateCartItemQuantity,
} from "@/lib/order-cart";

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 7h16M9 7V5h6v2M8 10v7M12 10v7M16 10v7M6 7l1 13h10l1-13" />
    </svg>
  );
}

export default function OrderCheckout() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [details, setDetails] = useState<CustomerDetails>(initialCustomerDetails);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncCart = () => setCart(loadCart());
    syncCart();
    return subscribeToCartUpdates(syncCart);
  }, []);

  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const itemCount = useMemo(() => getCartCount(cart), [cart]);

  const onDetailsChange = (field: keyof CustomerDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleQuantity = (cartId: string, nextQuantity: number) => {
    updateCartItemQuantity(cartId, nextQuantity);
    setCart(loadCart());
  };

  const handleRemove = (cartId: string) => {
    removeCartItem(cartId);
    setCart(loadCart());
  };

  const handleBuyNow = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (cart.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    if (!details.fullName.trim() || !details.phone.trim() || !details.address.trim()) {
      setErrorMessage("Please fill your name, phone, and address.");
      return;
    }

    const payload = {
      customer: details,
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        side: item.side?.name ?? null,
        sauces: item.sauces.map((sauce) => sauce.name),
        drink: item.drink?.name ?? null,
        unitPrice: getItemUnitPrice(item),
        totalPrice: getItemUnitPrice(item) * item.quantity,
      })),
      totals: {
        itemCount,
        subtotal,
      },
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        if (
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
        ) {
          throw new Error(data.error);
        }

        throw new Error("Could not place your order.");
      }

      clearCart();
      setCart([]);
      setDetails(initialCustomerDetails);
      setSuccessMessage("Order placed successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not place your order.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-blue-300/90">
              Biteva Checkout
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Review your cart.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Adjust quantities, fill customer details, then send the order.
            </p>
          </div>

          <Link
            href="/order"
            className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            Back to menu
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            {cart.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-[#0b1729] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
                <h2 className="text-2xl font-semibold text-white">Your cart is empty</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                  Go back to the menu and add your meals. The cart icon on the order
                  page brings you back here.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <article
                  key={item.cartId}
                  className="rounded-[28px] border border-white/10 bg-[#0b1729] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                        {item.product.name}
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        <p>
                          Side: <span className="text-white">{item.side?.name ?? "No side"}</span>
                        </p>
                        <p>
                          Sauces:{" "}
                          <span className="text-white">
                            {item.sauces.length > 0
                              ? item.sauces.map((sauce) => sauce.name).join(", ")
                              : "No sauce"}
                          </span>
                        </p>
                        <p>
                          Drink: <span className="text-white">{item.drink?.name ?? "No drink"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-4 sm:items-end">
                      <p className="text-xl font-semibold text-white">
                        {formatMoney(getItemUnitPrice(item) * item.quantity)}
                      </p>

                      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                        <button
                          type="button"
                          onClick={() => handleQuantity(item.cartId, item.quantity - 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10"
                          aria-label="Decrease quantity"
                        >
                          <MinusIcon />
                        </button>
                        <span className="min-w-10 text-center text-sm font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantity(item.cartId, item.quantity + 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10"
                          aria-label="Increase quantity"
                        >
                          <PlusIcon />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(item.cartId)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                      >
                        <TrashIcon />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="rounded-[30px] border border-white/10 bg-[#0b1729] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6">
            <h2 className="text-2xl font-semibold text-white">Customer details</h2>
            <p className="mt-2 text-sm text-slate-300">
              These details are sent together with the cart when you press buy now.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Full name</span>
                <input
                  value={details.fullName}
                  onChange={(event) => onDetailsChange("fullName", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#091120] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="Your full name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Phone</span>
                <input
                  value={details.phone}
                  onChange={(event) => onDetailsChange("phone", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#091120] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="Your phone number"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Address</span>
                <textarea
                  value={details.address}
                  onChange={(event) => onDetailsChange("address", event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-[#091120] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="Street, building, floor, note"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Order note</span>
                <textarea
                  value={details.note}
                  onChange={(event) => onDetailsChange("note", event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-[#091120] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="Optional note"
                />
              </label>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Items</span>
                <span className="text-white">{itemCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span className="text-white">{formatMoney(subtotal)}</span>
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {successMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isSubmitting || cart.length === 0}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.3)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSubmitting ? "Sending order..." : "Buy now"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
