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

type OrderFormState = {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  quantity: number;
};

const PRODUCT_NAME = "Biteva Box";
const PRODUCT_SLUG = "biteva-box";
const PRODUCT_PRICE_CENTS = 3990;
const INITIAL_FORM: OrderFormState = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "Austria",
  quantity: 1,
};

function formatEuro(cents: number) {
  return new Intl.NumberFormat("en-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function OrderPage() {
  const [form, setForm] = useState<OrderFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<OrderResponse["order"] | null>(null);

  const totalLabel = useMemo(
    () => formatEuro(form.quantity * PRODUCT_PRICE_CENTS),
    [form.quantity]
  );

  function updateField<Key extends keyof OrderFormState>(
    key: Key,
    value: OrderFormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

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
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          postalCode: form.postalCode,
          country: form.country,
          quantity: form.quantity,
          productSlug: PRODUCT_SLUG,
        }),
      });

      const data = (await response.json()) as OrderResponse | ErrorResponse;


      if (!response.ok || !("ok" in data)) {
        const message = "error" in data ? data.error : undefined;
        setError(message ?? "Could not create your order.");
        return;
      }
      setSuccess(data.order);
      setForm(INITIAL_FORM);
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
          <div className="order-field-grid">
            <label>
              <span>Full name</span>
              <input
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
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
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                required
                autoComplete="email"
                name="email"
              />
            </label>
          </div>

          <div className="order-field-grid">
            <label>
              <span>Phone</span>
              <input
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
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
                value={form.quantity}
                onChange={(event) =>
                  updateField("quantity", Number(event.target.value) || 1)
                }
                name="quantity"
              />
            </label>
          </div>

          <label>
            <span>Address line 1</span>
            <input
              value={form.addressLine1}
              onChange={(event) => updateField("addressLine1", event.target.value)}
              required
              autoComplete="address-line1"
              name="addressLine1"
            />
          </label>

          <label>
            <span>Address line 2</span>
            <input
              value={form.addressLine2}
              onChange={(event) => updateField("addressLine2", event.target.value)}
              autoComplete="address-line2"
              name="addressLine2"
            />
          </label>

          <div className="order-field-grid order-field-grid--triple">
            <label>
              <span>City</span>
              <input
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                required
                autoComplete="address-level2"
                name="city"
              />
            </label>

            <label>
              <span>Postal code</span>
              <input
                value={form.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                required
                autoComplete="postal-code"
                name="postalCode"
              />
            </label>

            <label>
              <span>Country</span>
              <input
                value={form.country}
                onChange={(event) => updateField("country", event.target.value)}
                required
                autoComplete="country-name"
                name="country"
              />
            </label>
          </div>

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
