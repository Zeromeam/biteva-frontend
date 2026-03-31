"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type OrderResponse = {
  ok: true;
  order: {
    orderNumber: string;
    totalAmountCents: number;
    currency: string;
  };
};

type ErrorResponse = {
  error?: string;
};

const PRODUCT_NAME = "Biteva Box";
const PRODUCT_SLUG = "biteva-box";
const PRODUCT_PRICE_CENTS = 3990;

function formatEuro(cents: number) {
  return new Intl.NumberFormat("en-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function OrderPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<OrderResponse["order"] | null>(null);

  const totalLabel = useMemo(
    () => formatEuro(quantity * PRODUCT_PRICE_CENTS),
    [quantity]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          quantity,
          productSlug: PRODUCT_SLUG,
        }),
      });

      const data = (await response.json()) as OrderResponse | ErrorResponse;

      
      if (!response.ok || !("ok" in data)) {
        setError("error" in data ? (data.error ?? "Could not create your order.") : "Could not create your order.");
        return;
      }

      setSuccess(data.order);
      setFullName("");
      setEmail("");
      setPhone("");
      setQuantity(1);
    } catch {
      setError("Could not create your order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="order-shell">
      <div className="order-page-header">
        <Link href="/" className="back-link">
          ← Back
        </Link>
      </div>

      <section className="order-card">
        <div className="order-copy">
          <p className="eyebrow">Order</p>
          <h1>{PRODUCT_NAME}</h1>
          <p className="price-line">{formatEuro(PRODUCT_PRICE_CENTS)}</p>
        </div>

        <form className="order-form" onSubmit={handleSubmit}>
          <label>
            <span>Full name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              minLength={2}
              autoComplete="name"
              name="fullName"
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              name="email"
            />
          </label>

          <label>
            <span>Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              name="phone"
            />
          </label>

          <label>
            <span>Quantity</span>
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value) || 1)}
              name="quantity"
            />
          </label>

          <div className="order-summary">
            <span>Total</span>
            <strong>{totalLabel}</strong>
          </div>

          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? "Sending..." : "Place order"}
          </button>

          {error ? <p className="form-message form-message--error">{error}</p> : null}

          {success ? (
            <div className="form-message form-message--success">
              <p>Order created.</p>
              <p>{success.orderNumber}</p>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
