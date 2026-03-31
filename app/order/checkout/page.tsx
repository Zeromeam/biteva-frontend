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

export default function CheckoutPage() {
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

  const itemCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);

  const updateDetails = (field: keyof CustomerDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const changeQuantity = (cartId: string, quantity: number) => {
    updateCartItemQuantity(cartId, quantity);
    setCart(loadCart());
  };

  const removeItem = (cartId: string) => {
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

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
          customer: details,
          subtotal,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setErrorMessage(data?.error ?? "Could not create your order.");
        return;
      }

      clearCart();
      setCart([]);
      setDetails(initialCustomerDetails);
      setSuccessMessage("Order sent successfully.");
    } catch {
      setErrorMessage("Could not send the order right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-blue-300">
              Biteva Checkout
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Review your cart.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Adjust quantities, fill your details, then place the order.
            </p>
          </div>

          <Link
            href="/order"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Back to menu
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-4">
            {cart.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <h2 className="text-2xl font-semibold text-white">Your cart is empty</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                  Go back to the menu and add your meals first.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <article
                  key={item.cartId}
                  className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-100">
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

                      <div className="inline-flex items-center rounded-full border border-white/10 bg-black/20 p-1">
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.cartId, item.quantity - 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-100 transition hover:bg-white/10"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-sm font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.cartId, item.quantity + 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-100 transition hover:bg-white/10"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.cartId)}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6 lg:sticky lg:top-6 lg:h-fit">
            <h2 className="text-2xl font-semibold text-white">Customer details</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              These details are sent together with the cart.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Full name</span>
                <input
                  value={details.fullName}
                  onChange={(event) => updateDetails("fullName", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  placeholder="Your full name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Phone</span>
                <input
                  value={details.phone}
                  onChange={(event) => updateDetails("phone", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  placeholder="Your phone number"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Address</span>
                <textarea
                  value={details.address}
                  onChange={(event) => updateDetails("address", event.target.value)}
                  className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  placeholder="Street, building, floor, door"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Note</span>
                <textarea
                  value={details.note}
                  onChange={(event) => updateDetails("note", event.target.value)}
                  className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  placeholder="Anything we should know?"
                />
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Items</span>
                <span>{itemCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-lg font-semibold text-white">
                <span>Total</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {successMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isSubmitting}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-blue-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Sending..." : "Buy now"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
