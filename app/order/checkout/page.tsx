"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackCheckoutStarted, trackOrderCompleted, trackPaymentAttempted } from "@/lib/analytics";
import {
  BillingDetails,
  CartItem,
  clearCart,
  CustomerDetails,
  formatMoney,
  getCartCount,
  getCartSubtotal,
  getItemUnitPrice,
  initialBillingDetails,
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
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Dynamically import the map component to avoid SSR issues
const DeliveryMap = dynamic(() => import("./DeliveryMap"), { ssr: false, loading: () => (
  <div style={{ height: "52px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1.5px solid #D99E4F", display: "flex", alignItems: "center", justifyContent: "center", color: "#D99E4F", fontSize: "14px" }}>
    Loading…
  </div>
) });

const BagIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

// ── Payment section (must be inside <Elements>) ───────────────────────────────

interface PaymentSectionProps {
  cart: CartItem[];
  details: CustomerDetails;
  billing: BillingDetails;
  deliveryMode: "address" | "gps";
  gpsCoords: { lat: number; lng: number } | null;
  subtotalCents: number;
  scheduledFor: string | null;
  onValidationError: (msg: string) => void;
  onSuccess: (orderNumber: string) => void;
  onError: (msg: string) => void;
}

/** Shared helper — creates an order after a successful Stripe PaymentIntent */
async function createOrder(
  cart: CartItem[],
  details: CustomerDetails,
  subtotalCents: number,
  paymentIntentId: string,
  deliveryMode: "address" | "gps",
  gpsCoords: { lat: number; lng: number } | null,
  scheduledFor: string | null,
): Promise<{ ok: true; orderNumber: string } | { ok: false; error: string }> {
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
          sauces: item.sauces.map((s) => s.name),
          drink: item.drink?.name ?? null,
          unitPrice: getItemUnitPrice(item),
          totalPrice: getItemUnitPrice(item) * item.quantity,
        })),
        deliveryMode,
        ...(deliveryMode === "gps" && gpsCoords
          ? { deliveryLat: gpsCoords.lat, deliveryLng: gpsCoords.lng }
          : {}),
        customer: details,
        subtotal: subtotalCents / 100,
        stripePaymentIntentId: paymentIntentId,
        ...(scheduledFor ? { scheduledFor } : {}),
      }),
    });
    const data = await res.json() as { orderNumber?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Order could not be saved. Please contact support." };
    return { ok: true, orderNumber: data.orderNumber ?? "" };
  } catch {
    return { ok: false, error: "Order could not be saved. Please contact support." };
  }
}

/** Shared helper — creates a PaymentIntent on the server and returns the clientSecret. */
async function fetchClientSecret(amountCents: number, cardOnly = false): Promise<string | null> {
  try {
    const res = await fetch("/api/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents, currency: "eur", cardOnly }),
    });
    const data = await res.json() as { clientSecret?: string };
    return data.clientSecret ?? null;
  } catch {
    return null;
  }
}

// ── Card form — lives inside its own card-only <Elements clientSecret> ─────────

interface CardFormProps {
  cart: CartItem[];
  details: CustomerDetails;
  billing: BillingDetails;
  deliveryMode: "address" | "gps";
  gpsCoords: { lat: number; lng: number } | null;
  subtotalCents: number;
  scheduledFor: string | null;
  clientSecret: string;
  onSuccess: (orderNumber: string) => void;
  onError: (msg: string) => void;
}

function CardForm({ cart, details, billing, deliveryMode, gpsCoords, subtotalCents, scheduledFor, clientSecret, onSuccess, onError }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPaying, setIsPaying] = useState(false);

  const formattedTotal = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(subtotalCents / 100);

  const handlePay = async () => {
    if (!stripe || !elements || isPaying) return;
    setIsPaying(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) { onError(submitError.message ?? "Please check your card details."); return; }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/order/checkout`,
          payment_method_data: {
            billing_details: {
              name: billing.name,
              phone: details.phone,
              email: details.email || undefined,
              address: {
                line1: billing.address,
                city: billing.city,
                postal_code: billing.postalCode,
                country: billing.country || "AT",
                state: "",
              },
            },
          },
        },
        redirect: "if_required",
      });

      if (error) { onError(error.message ?? "Payment failed."); return; }
      if (paymentIntent?.status !== "succeeded") { onError("Payment was not completed."); return; }

      const result = await createOrder(cart, details, subtotalCents, paymentIntent.id, deliveryMode, gpsCoords, scheduledFor);
      if (!result.ok) { onError(result.error); return; }
      clearCart();
      onSuccess(result.orderNumber);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <PaymentElement
        options={{
          fields: {
            billingDetails: {
              name: "never",
              phone: "never",
              email: "never",
              address: "never",
            },
          },
        }}
      />
      <button
        type="button"
        onClick={handlePay}
        disabled={isPaying || !stripe}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", padding: "15px 24px", borderRadius: "14px",
          border: "1px solid rgba(217,158,79,0.35)",
          background: isPaying ? "rgba(217,158,79,0.07)" : "#D99E4F",
          color: isPaying ? "#D99E4F" : "#000",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: "14px", fontWeight: 600,
          cursor: isPaying ? "not-allowed" : "pointer",
          opacity: isPaying ? 0.7 : 1,
          transition: "all 0.2s",
        }}
      >
        {isPaying ? "Processing…" : `Pay ${formattedTotal}`}
      </button>
    </div>
  );
}

function PaymentSection({ cart, details, billing, deliveryMode, gpsCoords, subtotalCents, scheduledFor, onValidationError, onSuccess, onError }: PaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [showCardForm, setShowCardForm] = useState(false);
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);

  useEffect(() => {
    setShowCardForm(false);
    setCardClientSecret(null);
  }, [subtotalCents]);

  const validate = (): boolean => {
    if (cart.length === 0) { onValidationError("Your cart is empty."); return false; }

    if (deliveryMode === "address") {
      if (!details.fullName.trim() || !details.phone.trim() || !details.address.trim() || !details.city.trim() || !details.postalCode.trim()) {
        onValidationError("Please fill in your name, phone, address, city, and postal code.");
        return false;
      }
    } else {
      if (!details.fullName.trim() || !details.phone.trim()) {
        onValidationError("Please fill in your name and phone number.");
        return false;
      }
      if (!gpsCoords) {
        onValidationError("Please pin your location on the map before paying.");
        return false;
      }
    }

    if (!billing.name.trim() || !billing.address.trim() || !billing.city.trim() || !billing.postalCode.trim()) {
      onValidationError("Please fill in the billing name, street, city, and postal code.");
      return false;
    }

    return true;
  };

  // ── Apple Pay / Google Pay ───────────────────────────────────────────────
  const handleExpressConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;
    if (!validate()) { event.paymentFailed({ reason: "fail" }); return; }
    trackPaymentAttempted("express", subtotalCents / 100);

    const clientSecret = await fetchClientSecret(subtotalCents, false);
    if (!clientSecret) { event.paymentFailed({ reason: "fail" }); onError("Could not start payment."); return; }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/order/checkout`,
        payment_method_data: {
          billing_details: {
            name: billing.name,
            phone: details.phone,
            email: details.email || undefined,
            address: {
              line1: billing.address,
              city: billing.city,
              postal_code: billing.postalCode,
              country: billing.country || "AT",
            },
          },
        },
      },
      redirect: "if_required",
    });

    if (error) { onError(error.message ?? "Payment failed."); return; }
    if (paymentIntent?.status !== "succeeded") { onError("Payment was not completed."); return; }

    const result = await createOrder(cart, details, subtotalCents, paymentIntent.id, deliveryMode, gpsCoords, scheduledFor);
    if (!result.ok) { onError(result.error); return; }
    clearCart();
    onSuccess(result.orderNumber);
  };

  // ── Card form toggle ────────────────────────────────────────────────────
  const handleToggleCard = async () => {
    if (showCardForm) { setShowCardForm(false); return; }
    if (!validate()) return;
    trackPaymentAttempted("card", subtotalCents / 100);
    setIsLoadingCard(true);
    const secret = await fetchClientSecret(subtotalCents, true);
    setIsLoadingCard(false);
    if (!secret) { onError("Could not start card payment."); return; }
    setCardClientSecret(secret);
    setShowCardForm(true);
  };

  const cardAppearance = {
    theme: "night" as const,
    variables: { colorBackground: "#0c0c0c", colorText: "#e2ddd6", borderRadius: "14px" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <ExpressCheckoutElement
        onConfirm={handleExpressConfirm}
        options={{
          buttonType: { applePay: "buy", googlePay: "buy" },
          layout: { maxColumns: 1, maxRows: 3, overflow: "auto" },
        }}
      />

      <button
        type="button"
        onClick={handleToggleCard}
        disabled={isLoadingCard}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          width: "100%", padding: "13px 24px", borderRadius: "14px",
          border: showCardForm ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.1)",
          background: showCardForm ? "rgba(217,158,79,0.06)" : "rgba(255,255,255,0.03)",
          color: showCardForm ? "#D99E4F" : "#9a9290",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: "14px", fontWeight: 500,
          cursor: isLoadingCard ? "wait" : "pointer",
          transition: "all 0.2s",
          opacity: isLoadingCard ? 0.6 : 1,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        {isLoadingCard ? "Loading…" : "Pay with card"}
      </button>

      {showCardForm && cardClientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret: cardClientSecret, appearance: cardAppearance }}>
          <CardForm
            cart={cart}
            details={details}
            billing={billing}
            deliveryMode={deliveryMode}
            gpsCoords={gpsCoords}
            subtotalCents={subtotalCents}
            scheduledFor={scheduledFor}
            clientSecret={cardClientSecret}
            onSuccess={(orderNumber) => { onSuccess(orderNumber); }}
            onError={onError}
          />
        </Elements>
      )}
    </div>
  );
}

// ── Billing address form ──────────────────────────────────────────────────────

interface BillingFormProps {
  billing: BillingDetails;
  onChange: (field: keyof BillingDetails, value: string) => void;
}

function BillingForm({ billing, onChange }: BillingFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Cardholder name</label>
        <input
          className="checkout-input"
          value={billing.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Name on card"
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Street address</label>
        <input
          className="checkout-input"
          value={billing.address}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="Street, building, door"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>City</label>
          <input
            className="checkout-input"
            value={billing.city}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="Vienna"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Postal code</label>
          <input
            className="checkout-input"
            value={billing.postalCode}
            onChange={(e) => onChange("postalCode", e.target.value)}
            placeholder="1010"
          />
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>
          Country <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#3a3a3a", fontSize: "11px" }}>(ISO code)</span>
        </label>
        <input
          className="checkout-input"
          value={billing.country}
          onChange={(e) => onChange("country", e.target.value.toUpperCase().slice(0, 2))}
          placeholder="AT"
          maxLength={2}
        />
      </div>
    </div>
  );
}

// ── Delivery time selector ────────────────────────────────────────────────────

const OPERATING_START = 10; // 10:00
const OPERATING_END = 22;   // 22:00
const MIN_ADVANCE_HOURS = 2;
const MAX_ADVANCE_DAYS = 30;

function buildTimeSlots(selectedDate: string): string[] {
  const slots: string[] = [];
  const now = new Date();
  const isToday = selectedDate === now.toISOString().slice(0, 10);

  for (let h = OPERATING_START; h < OPERATING_END; h++) {
    for (const m of [0, 30]) {
      const slot = new Date(selectedDate + "T" + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":00");
      const minTime = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);
      if (isToday && slot < minTime) continue;
      slots.push(slot.toTimeString().slice(0, 5));
    }
  }
  return slots;
}

function DeliveryTimeSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const isScheduled = value !== null;

  const today = new Date();

  const minDate = (() => {
    const lastSlotToday = new Date(today.toISOString().slice(0, 10) + `T${OPERATING_END - 1}:30:00`);
    const minTime = new Date(today.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);
    return minTime < lastSlotToday
      ? today.toISOString().slice(0, 10)
      : (() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  })();

  const maxDate = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + MAX_ADVANCE_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

  const selectedDate = value ? value.slice(0, 10) : minDate;
  const selectedTime = value ? value.slice(11, 16) : "";
  const timeSlots = buildTimeSlots(selectedDate);

  // ── DD.MM.YYYY segmented date input state ──
  const [ddRaw, setDdRaw] = useState(() => selectedDate.slice(8));
  const [mmRaw, setMmRaw] = useState(() => selectedDate.slice(5, 7));
  const [yyyyRaw, setYyyyRaw] = useState(() => selectedDate.slice(0, 4));
  const [dateError, setDateError] = useState<string | null>(null);
  const refMm = useRef<HTMLInputElement>(null);
  const refYyyy = useRef<HTMLInputElement>(null);

  // Keep segments in sync when value changes externally (e.g. on toggle)
  useEffect(() => {
    setDdRaw(selectedDate.slice(8));
    setMmRaw(selectedDate.slice(5, 7));
    setYyyyRaw(selectedDate.slice(0, 4));
    setDateError(null);
  }, [selectedDate]);

  function applyDate(dd: string, mm: string, yyyy: string) {
    if (dd.length < 2 || mm.length < 2 || yyyy.length < 4) return; // not complete yet
    const iso = `${yyyy}-${mm}-${dd}`;
    const parsed = new Date(iso + "T00:00:00");
    if (isNaN(parsed.getTime())) { setDateError("Invalid date"); return; }
    if (iso < minDate) { setDateError(`Too early — from ${fmt(minDate)}`); return; }
    if (iso > maxDate) { setDateError(`Too far ahead — until ${fmt(maxDate)}`); return; }
    setDateError(null);
    const slots = buildTimeSlots(iso);
    const time = slots.length > 0 ? slots[0] : "12:00";
    onChange(`${iso}T${time}:00+00:00`);
  }

  function handleToggle(scheduled: boolean) {
    if (!scheduled) { setDateError(null); onChange(null); return; }
    const slots = buildTimeSlots(minDate);
    if (slots.length > 0) onChange(`${minDate}T${slots[0]}:00+00:00`);
  }

  function handleTimeChange(time: string) {
    onChange(`${selectedDate}T${time}:00+00:00`);
  }

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "#525252", marginBottom: "8px",
  };

  // Shared style for each segment input
  const segStyle: React.CSSProperties = {
    background: "transparent", border: "none", outline: "none",
    color: "#e8e3de", fontSize: "15px", fontWeight: 500, padding: 0, margin: 0,
    fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "center",
  };

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: "flex", gap: "8px", marginBottom: isScheduled ? "14px" : "0" }}>
        <button type="button" onClick={() => handleToggle(false)}
          style={{
            flex: 1, padding: "10px 16px", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s",
            fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 600,
            border: !isScheduled ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.08)",
            background: !isScheduled ? "rgba(217,158,79,0.08)" : "rgba(255,255,255,0.02)",
            color: !isScheduled ? "#D99E4F" : "#5a5550",
          }}>
          As soon as possible
        </button>
        <button type="button" onClick={() => handleToggle(true)}
          style={{
            flex: 1, padding: "10px 16px", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s",
            fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 600,
            border: isScheduled ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.08)",
            background: isScheduled ? "rgba(217,158,79,0.08)" : "rgba(255,255,255,0.02)",
            color: isScheduled ? "#D99E4F" : "#5a5550",
          }}>
          Schedule for later
        </button>
      </div>

      {/* Date + time — only when scheduled */}
      {isScheduled && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

            {/* ── Segmented DD.MM.YYYY input ── */}
            <div>
              <label style={labelStyle}>Date</label>
              {/* Outer box looks like checkout-input; inner inputs are invisible */}
              <div
                className="checkout-input"
                style={{
                  display: "flex", alignItems: "center", gap: "1px", cursor: "text",
                  border: dateError ? "1px solid rgba(239,68,68,0.55)" : undefined,
                }}
                onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
              >
                {/* DD */}
                <input
                  style={{ ...segStyle, width: "26px" }}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="TT"
                  value={ddRaw}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setDdRaw(v);
                    if (v.length === 2) refMm.current?.focus();
                    applyDate(v, mmRaw, yyyyRaw);
                  }}
                />
                <span style={{ color: "#3a3a3a", fontSize: "15px", lineHeight: 1, userSelect: "none" }}>.</span>
                {/* MM */}
                <input
                  ref={refMm}
                  style={{ ...segStyle, width: "26px" }}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={mmRaw}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setMmRaw(v);
                    if (v.length === 2) refYyyy.current?.focus();
                    applyDate(ddRaw, v, yyyyRaw);
                  }}
                />
                <span style={{ color: "#3a3a3a", fontSize: "15px", lineHeight: 1, userSelect: "none" }}>.</span>
                {/* YYYY */}
                <input
                  ref={refYyyy}
                  style={{ ...segStyle, width: "44px" }}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="JJJJ"
                  value={yyyyRaw}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setYyyyRaw(v);
                    applyDate(ddRaw, mmRaw, v);
                  }}
                />
              </div>
            </div>

            {/* Time — disabled when date invalid or no slots */}
            <div>
              <label style={{ ...labelStyle, opacity: dateError ? 0.35 : 1 }}>Time</label>
              <select
                className="checkout-input"
                value={selectedTime}
                disabled={!!dateError || timeSlots.length === 0}
                onChange={(e) => handleTimeChange(e.target.value)}
                style={{
                  appearance: "none",
                  cursor: dateError || timeSlots.length === 0 ? "not-allowed" : "pointer",
                  opacity: dateError || timeSlots.length === 0 ? 0.35 : 1,
                }}
              >
                {timeSlots.length === 0
                  ? <option value="">No slots available</option>
                  : timeSlots.map((s) => <option key={s} value={s}>{s}</option>)
                }
              </select>
            </div>
          </div>

          {/* Error or hint */}
          {dateError
            ? <p style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>⚠ {dateError}</p>
            : <p style={{ margin: 0, fontSize: "11px", color: "#3a3a3a" }}>Available {fmt(minDate)} – {fmt(maxDate)}</p>
          }
        </div>
      )}
    </div>
  );
}

// ── Main checkout page ────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [details, setDetails] = useState<CustomerDetails>(initialCustomerDetails);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delivery mode
  const [deliveryMode, setDeliveryMode] = useState<"address" | "gps">("address");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Scheduled delivery — null means ASAP
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  // Billing
  const [billingSameAsDelivery, setBillingSameAsDelivery] = useState(true);
  const [billingDetails, setBillingDetails] = useState<BillingDetails>(initialBillingDetails);

  const effectiveBilling = useMemo<BillingDetails>(() => {
    if (deliveryMode === "address" && billingSameAsDelivery) {
      return {
        name: details.fullName,
        address: details.address,
        city: details.city,
        postalCode: details.postalCode,
        country: details.country,
      };
    }
    return billingDetails;
  }, [deliveryMode, billingSameAsDelivery, details, billingDetails]);

  useEffect(() => {
    const syncCart = () => setCart(loadCart());
    syncCart();
    return subscribeToCartUpdates(syncCart);
  }, []);

  const trackedCheckout = useRef(false);
  useEffect(() => {
    if (!trackedCheckout.current && cart.length > 0) {
      trackedCheckout.current = true;
      trackCheckoutStarted(getCartCount(cart), getCartSubtotal(cart));
    }
  }, [cart]);

  const itemCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const subtotalCents = useMemo(() => Math.round(subtotal * 100), [subtotal]);

  const updateDetails = (field: keyof CustomerDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const updateBillingDetails = (field: keyof BillingDetails, value: string) => {
    setBillingDetails((prev) => ({ ...prev, [field]: value }));
  };

  const changeQuantity = (cartId: string, quantity: number) => {
    updateCartItemQuantity(cartId, quantity);
    setCart(loadCart());
  };

  const removeItem = (cartId: string) => {
    removeCartItem(cartId);
    setCart(loadCart());
  };

  const handleSwitchMode = (mode: "address" | "gps") => {
    setDeliveryMode(mode);
    setErrorMessage(null);
    if (mode === "address") {
      setBillingSameAsDelivery(true);
    }
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-block", padding: "6px 16px", borderRadius: "99px", border: "1px solid rgba(217,158,79,0.3)", background: "rgba(217,158,79,0.07)", fontSize: "13px", fontWeight: 600, color: "#D99E4F", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                        {item.product.name}
                      </span>
                      <p style={{ fontSize: "20px", fontWeight: 600, color: "#fff", margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                        {formatMoney(getItemUnitPrice(item) * item.quantity)}
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#5a5550", lineHeight: 1.5 }}>
                      <p style={{ margin: 0 }}>Side: <span style={{ color: "#9a9290" }}>{item.side?.name ?? "No side"}</span></p>
                      <p style={{ margin: 0 }}>Sauces: <span style={{ color: "#9a9290" }}>{item.sauces.length > 0 ? item.sauces.map((s) => s.name).join(", ") : "No sauce"}</span></p>
                      <p style={{ margin: 0 }}>Drink: <span style={{ color: "#9a9290" }}>{item.drink?.name ?? "No drink"}</span></p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
                        <button type="button" onClick={() => changeQuantity(item.cartId, item.quantity - 1)} style={{ width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: item.quantity <= 1 ? "#333" : "#777", fontSize: "18px", cursor: item.quantity <= 1 ? "not-allowed" : "pointer", fontWeight: 300, lineHeight: 1 }} aria-label="Decrease quantity">−</button>
                        <span style={{ width: "34px", textAlign: "center", fontSize: "15px", fontWeight: 600, color: "#fff", lineHeight: "38px" }}>{item.quantity}</span>
                        <button type="button" onClick={() => changeQuantity(item.cartId, item.quantity + 1)} style={{ width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "#777", fontSize: "18px", cursor: "pointer", fontWeight: 300, lineHeight: 1 }} aria-label="Increase quantity">+</button>
                      </div>
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
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "22px", fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>Delivery details</h2>
              <p style={{ fontSize: "13px", color: "#5a5550", margin: "0 0 20px", lineHeight: 1.5 }}>How and where should we deliver your order?</p>

              {/* Mode toggle */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("address")}
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: "12px", border: deliveryMode === "address" ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    background: deliveryMode === "address" ? "rgba(217,158,79,0.08)" : "rgba(255,255,255,0.02)",
                    color: deliveryMode === "address" ? "#D99E4F" : "#5a5550",
                    fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  Enter address
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("gps")}
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: "12px", border: deliveryMode === "gps" ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    background: deliveryMode === "gps" ? "rgba(217,158,79,0.08)" : "rgba(255,255,255,0.02)",
                    color: deliveryMode === "gps" ? "#D99E4F" : "#5a5550",
                    fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  📍 GPS location
                </button>
              </div>

              {/* ── Contact ─────────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D99E4F" }}>Contact</p>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Full name</label>
                  <input className="checkout-input" value={details.fullName} onChange={(e) => updateDetails("fullName", e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Phone</label>
                  <input className="checkout-input" value={details.phone} onChange={(e) => updateDetails("phone", e.target.value)} placeholder="+43 123 456 789" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>
                    Email <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#3a3a3a", fontSize: "11px" }}>(optional — for receipt)</span>
                  </label>
                  <input className="checkout-input" type="email" value={details.email} onChange={(e) => updateDetails("email", e.target.value)} placeholder="your@email.com" />
                </div>
              </div>

              {/* ── Delivery address / GPS ───────────────────────── */}
              <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />

              {deliveryMode === "address" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D99E4F" }}>Delivery address</p>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Street & number</label>
                    <input className="checkout-input" value={details.address} onChange={(e) => updateDetails("address", e.target.value)} placeholder="e.g. Mariahilfer Straße 42" />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "4px" }}>
                      Apt / Floor / Door <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#3a3a3a", fontSize: "11px" }}>(optional)</span>
                    </label>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#3a3a3a" }}>Staircase, floor, or door number if applicable</p>
                    <input className="checkout-input" value={details.addressLine2} onChange={(e) => updateDetails("addressLine2", e.target.value)} placeholder="e.g. Stiege 2, Top 14" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>City</label>
                      <input className="checkout-input" value={details.city} onChange={(e) => updateDetails("city", e.target.value)} placeholder="Vienna" />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>Postal code</label>
                      <input className="checkout-input" value={details.postalCode} onChange={(e) => updateDetails("postalCode", e.target.value)} placeholder="1060" />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>
                      Country <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#3a3a3a", fontSize: "11px" }}>(2-letter code, e.g. AT)</span>
                    </label>
                    <input className="checkout-input" value={details.country} onChange={(e) => updateDetails("country", e.target.value.toUpperCase().slice(0, 2))} placeholder="AT" maxLength={2} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>
                      Delivery note <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#3a3a3a", fontSize: "11px" }}>(optional)</span>
                    </label>
                    <textarea className="checkout-textarea" rows={2} value={details.note} onChange={(e) => updateDetails("note", e.target.value)} placeholder="Ring bell, leave at door, call on arrival…" />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D99E4F" }}>Delivery location</p>
                  <DeliveryMap coords={gpsCoords} onCoordsChange={setGpsCoords} />
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525252", marginBottom: "8px" }}>
                      Location note <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#3a3a3a", fontSize: "11px" }}>(optional)</span>
                    </label>
                    <textarea className="checkout-textarea" rows={2} value={details.note} onChange={(e) => updateDetails("note", e.target.value)} placeholder="E.g. near the fountain, red bench…" />
                  </div>
                </div>
              )}

              {/* ── When ────────────────────────────────────────── */}
              <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D99E4F" }}>When</p>
                <DeliveryTimeSelector value={scheduledFor} onChange={setScheduledFor} />
              </div>

              {/* ── Billing ─────────────────────────────────────── */}
              <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />

              {deliveryMode === "address" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D99E4F" }}>Billing</p>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={billingSameAsDelivery}
                      onChange={(e) => setBillingSameAsDelivery(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#D99E4F", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", color: "#9a9290", fontWeight: 500 }}>Billing address same as delivery</span>
                  </label>
                  {!billingSameAsDelivery && <BillingForm billing={billingDetails} onChange={updateBillingDetails} />}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D99E4F" }}>Billing address</p>
                    <p style={{ fontSize: "12px", color: "#3a3a3a", margin: 0 }}>Required for payment — GPS delivery has no postal address.</p>
                  </div>
                  <BillingForm billing={billingDetails} onChange={updateBillingDetails} />
                </div>
              )}
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

              {scheduledFor && (
                <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(217,158,79,0.25)", background: "rgba(217,158,79,0.06)", fontSize: "13px", color: "#D99E4F", lineHeight: 1.5 }}>
                  🕐 Scheduled for{" "}
                  <strong>
                    {new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(scheduledFor))}
                  </strong>
                </div>
              )}

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

              {subtotalCents > 0 && (
                <Elements
                  key={subtotalCents}
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
                  <PaymentSection
                    cart={cart}
                    details={details}
                    billing={effectiveBilling}
                    deliveryMode={deliveryMode}
                    gpsCoords={gpsCoords}
                    subtotalCents={subtotalCents}
                    scheduledFor={scheduledFor}
                    onValidationError={(msg) => setErrorMessage(msg)}
                    onSuccess={(orderNumber) => {
                      trackOrderCompleted(orderNumber, subtotal, details.email || undefined);
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
