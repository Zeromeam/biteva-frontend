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
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const BagIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

// ── Express Checkout inner component (must be inside <Elements>) ──────────────

interface ExpressCheckoutProps {
  cart: CartItem[];
  details: CustomerDetails;
  subtotalCents: number;
  onValidationError: (msg: string) => void;
  onSuccess: (orderNumber: string) => void;
  onError: (msg: string) => void;
}

function ExpressCheckout({ cart, details, subtotalCents, onValidationError, onSuccess, onError }: ExpressCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;

    // Validate form fields before proceeding
    if (cart.length === 0) {
      event.paymentFailed({ reason: "fail" });
      onValidationError("Your cart is empty.");
      return;
    }

    if (!details.fullName.trim() || !details.phone.trim() || !details.address.trim()) {
      event.paymentFailed({ reason: "fail" });
      onValidationError("Please fill your name, phone, and address.");
      return;
    }

    // Create PaymentIntent on server
    let clientSecret: string;
    try {
      const res = await fetch("/api/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: subtotalCents, currency: "eur" }),
      });
      const piData = await res.json() as { clientSecret?: string; error?: string };
      if (!res.ok || !piData.clientSecret) {
        event.paymentFailed({ reason: "fail" });
        onError(piData.error ?? "Could not start payment.");
        return;
      }
      clientSecret = piData.clientSecret;
    } catch {
      event.paymentFailed({ reason: "fail" });
      onError("Could not reach the server.");
      return;
    }

    // Confirm the payment (Apple Pay / Google Pay sheet)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/order/checkout`,
        payment_method_data: {
          billing_details: {
            name: details.fullName,
            phone: details.phone,
          },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Payment failed.");
      return;
    }

    if (paymentIntent?.status !== "succeeded") {
      onError("Payment was not completed.");
      return;
    }

    // Payment succeeded — create the order
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          subtotal: subtotalCents / 100,
          stripePaymentIntentId: paymentIntent.id,
        }),
      });

      const orderData = await res.json() as { orderNumber?: string; error?: string };

      if (!res.ok) {
        onError(orderData.error ?? "Payment succeeded but order could not be saved. Please contact support.");
        return;
      }

      clearCart();
      onSuccess(orderData.orderNumber ?? "");
    } catch {
      onError("Payment succeeded but order could not be saved. Please contact support.");
    }
  };

  return (
    <ExpressCheckoutElement
      onConfirm={handleConfirm}
      options={{
        buttonType: { applePay: "buy", googlePay: "buy" },
        layout: { maxColumns: 1, maxRows: 3, overflow: "auto" },
      }}
    />
  );
}

// ── Main checkout page ────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [details, setDetails] = useState<CustomerDetails>(initialCustomerDetails);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncCart = () => setCart(loadCart());
    syncCart();
    return subscribeToCartUpdates(syncCart);
  }, []);

  const itemCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const subtotalCents = useMemo(() => Math.round(subtotal * 100), [subtotal]);

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .checkout-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }
        @media (min-width: 900px) {
          .checkout-grid {
            grid-template-columns: 1.4fr 0.8fr;
          }
        }

        .checkout-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 13px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px;
          color: #e2ddd6;
          outline: none;
          transition: border-color 0.2s;
        }
        .checkout-input::placeholder { color: #3a3a3a; }
        .checkout-input:focus { border-color: rgba(217,158,79,0.5); }

        .checkout-textarea {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 13px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px;
          color: #e2ddd6;
          outline: none;
          resize: none;
          transition: border-color 0.2s;
        }
        .checkout-textarea::placeholder { color: #3a3a3a; }
        .checkout-textarea:focus { border-color: rgba(217,158,79,0.5); }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080808", color: "#e2ddd6", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* Nav */}
        <nav style={{ position: "sticky", top: 0, zIndex: 40, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,8,0.88)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "1100px", margin: "0 auto", padding: "14px 24px" }}>
            <div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", fontWeight: 600, fontStyle: "italic", color: "#D99E4F", letterSpacing: "0.04em", lineHeight: 1, margin: 0 }}>Biteva</p>
              <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: "#525252", marginTop: "2px", marginBottom: 0 }}>Fine Dining · Checkout</p>
            </div>
            <Link
              href="/order"
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#c4bcb2", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "14px", fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              <BagIcon size={16} />
              <span>Back to menu</span>
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "52px 24px 36px", animation: "fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: "#D99E4F", margin: "0 0 14px" }}>Your Order</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(38px, 5vw, 62px)", fontWeight: 600, lineHeight: 1.08, color: "#fff", margin: "0 0 14px" }}>
            Review your<br /><em style={{ fontStyle: "italic", color: "#D99E4F" }}>cart.</em>
          </h1>
          <p style={{ fontSize: "15px", color: "#5a5550", maxWidth: "400px", lineHeight: 1.65, margin: 0 }}>
            Adjust quantities, fill your details, then place the order.
          </p>
        </div>

        {/* Divider */}
        <div style={{ maxWidth: "1100px", margin: "0 auto 36px", padding: "0 24px" }}>
          <div style={{ height: "1px", background: "linear-gradient(90deg, rgba(217,158,79,0.35) 0%, rgba(255,255,255,0.05) 55%, transparent 100%)" }} />
        </div>

        {/* Main grid */}
        <div className="checkout-grid">

          {/* Cart items */}
          <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {cart.length === 0 ? (
              <div style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.07)", background: "#0c0c0c", padding: "40px 32px" }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#fff", margin: "0 0 10px" }}>Your cart is empty</h2>
                <p style={{ fontSize: "14px", color: "#5a5550", margin: 0, lineHeight: 1.6 }}>
                  Go back to the menu and add your meals first.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <article
                  key={item.cartId}
                  style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.07)", background: "#0c0c0c", padding: "22px 24px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {/* Product name badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-block", padding: "6px 16px", borderRadius: "99px", border: "1px solid rgba(217,158,79,0.3)", background: "rgba(217,158,79,0.07)", fontSize: "13px", fontWeight: 600, color: "#D99E4F", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                        {item.product.name}
                      </span>
                      <p style={{ fontSize: "20px", fontWeight: 600, color: "#fff", margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                        {formatMoney(getItemUnitPrice(item) * item.quantity)}
                      </p>
                    </div>

                    {/* Customisations */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5a5550", lineHeight: 1.5 }}>
                      <p style={{ margin: 0 }}>
                        Side: <span style={{ color: "#9a9290" }}>{item.side?.name ?? "No side"}</span>
                      </p>
                      <p style={{ margin: 0 }}>
                        Sauces:{" "}
                        <span style={{ color: "#9a9290" }}>
                          {item.sauces.length > 0 ? item.sauces.map((s) => s.name).join(", ") : "No sauce"}
                        </span>
                      </p>
                      <p style={{ margin: 0 }}>
                        Drink: <span style={{ color: "#9a9290" }}>{item.drink?.name ?? "No drink"}</span>
                      </p>
                    </div>

                    {/* Controls */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                      {/* Quantity */}
                      <div style={{ display: "flex", alignItems: "center", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.cartId, item.quantity - 1)}
                          style={{ width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: item.quantity <= 1 ? "#333" : "#777", fontSize: "18px", cursor: item.quantity <= 1 ? "not-allowed" : "pointer", fontWeight: 300, lineHeight: 1 }}
                          aria-label="Decrease quantity"
                        >−</button>
                        <span style={{ width: "34px", textAlign: "center", fontSize: "15px", fontWeight: 600, color: "#fff", lineHeight: "38px" }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(item.cartId, item.quantity + 1)}
                          style={{ width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "#777", fontSize: "18px", cursor: "pointer", fontWeight: 300, lineHeight: 1 }}
                          aria-label="Increase quantity"
                        >+</button>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.cartId)}
                        style={{ padding: "9px 20px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#5a5550", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 500, cursor: "pointer", transition: "border-color 0.2s, color 0.2s" }}
                        onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "rgba(255,80,80,0.3)"; el.style.color = "#ff8080"; }}
                        onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "#5a5550"; }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          {/* Order summary + details */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Customer details */}
            <div style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.07)", background: "#0c0c0c", padding: "24px" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "22px", fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>Your details</h2>
              <p style={{ fontSize: "13px", color: "#5a5550", margin: "0 0 20px", lineHeight: 1.5 }}>Sent together with your order.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Full name</label>
                  <input
                    className="checkout-input"
                    value={details.fullName}
                    onChange={(e) => updateDetails("fullName", e.target.value)}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Phone</label>
                  <input
                    className="checkout-input"
                    value={details.phone}
                    onChange={(e) => updateDetails("phone", e.target.value)}
                    placeholder="Your phone number"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Address</label>
                  <textarea
                    className="checkout-textarea"
                    rows={3}
                    value={details.address}
                    onChange={(e) => updateDetails("address", e.target.value)}
                    placeholder="Street, building, floor, door"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Note</label>
                  <textarea
                    className="checkout-textarea"
                    rows={2}
                    value={details.note}
                    onChange={(e) => updateDetails("note", e.target.value)}
                    placeholder="Anything we should know?"
                  />
                </div>
              </div>
            </div>

            {/* Order total + payment */}
            <div style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.07)", background: "#0c0c0c", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", color: "#5a5550", marginBottom: "12px" }}>
                <span>Items</span>
                <span>{itemCount}</span>
              </div>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", marginBottom: "14px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#9a9290" }}>Total</span>
                <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#D99E4F" }}>{formatMoney(subtotal)}</span>
              </div>

              {errorMessage && (
                <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(255,80,80,0.2)", background: "rgba(255,80,80,0.06)", fontSize: "13px", color: "#ff9090", lineHeight: 1.5 }}>
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(90,170,90,0.25)", background: "rgba(90,170,90,0.08)", fontSize: "13px", color: "#90d090", lineHeight: 1.5 }}>
                  {successMessage}
                </div>
              )}

              {/* Stripe Express Checkout (Apple Pay / Google Pay) */}
              {subtotalCents > 0 && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    mode: "payment",
                    amount: subtotalCents,
                    currency: "eur",
                    appearance: {
                      theme: "night",
                      variables: {
                        colorBackground: "#0c0c0c",
                        colorText: "#e2ddd6",
                        borderRadius: "14px",
                      },
                    },
                  }}
                >
                  <ExpressCheckout
                    cart={cart}
                    details={details}
                    subtotalCents={subtotalCents}
                    onValidationError={(msg) => setErrorMessage(msg)}
                    onSuccess={(orderNumber) => {
                      setCart([]);
                      setSuccessMessage(`Order ${orderNumber} placed successfully.`);
                    }}
                    onError={(msg) => setErrorMessage(msg)}
                  />
                </Elements>
              )}

              {cart.length === 0 && (
                <p style={{ fontSize: "13px", color: "#5a5550", textAlign: "center", margin: 0 }}>
                  Add items to your cart to proceed.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
