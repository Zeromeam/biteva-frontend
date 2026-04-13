"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "LATE_DELIVERY", label: "Late Delivery" },
  { value: "WRONG_ORDER", label: "Wrong Order" },
  { value: "QUALITY", label: "Quality Issue" },
  { value: "OTHER", label: "Other" },
] as const;

type Props = {
  orderNumber?: string;
  orderId?: string;
  initialName?: string;
  initialEmail?: string;
};

export function ComplaintForm({ orderNumber, orderId, initialName = "", initialEmail = "" }: Props) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject,
          message,
          name,
          email,
          phone: phone || undefined,
          orderId: orderId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "16px" }}>✓</div>
        <p style={{ fontSize: "18px", fontWeight: 600, color: "#e2ddd6", margin: "0 0 8px" }}>Complaint submitted</p>
        <p style={{ fontSize: "14px", color: "#9a9290", margin: 0 }}>
          We&apos;ve received your message and sent a confirmation to <strong style={{ color: "#e2ddd6" }}>{email}</strong>.
          We&apos;ll get back to you within 1–2 business days.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#e2ddd6",
    fontSize: "14px",
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    color: "#525252",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: "6px",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {orderNumber && (
        <div>
          <span style={labelStyle}>Order</span>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#e2ddd6" }}>{orderNumber}</div>
        </div>
      )}

      {/* Category */}
      <div>
        <label htmlFor="cf-category" style={labelStyle}>Category *</label>
        <select
          id="cf-category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ ...inputStyle, appearance: "none" }}
        >
          <option value="" disabled>Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="cf-subject" style={labelStyle}>Subject *</label>
        <input
          id="cf-subject"
          type="text"
          required
          maxLength={120}
          placeholder="Brief description of the issue"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="cf-message" style={labelStyle}>Message *</label>
        <textarea
          id="cf-message"
          required
          maxLength={1000}
          rows={5}
          placeholder="Please describe the issue in detail…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", minHeight: "120px" }}
        />
        <div style={{ fontSize: "11px", color: "#525252", marginTop: "4px", textAlign: "right" }}>
          {message.length}/1000
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="cf-name" style={labelStyle}>Full Name *</label>
        <input
          id="cf-name"
          type="text"
          required
          maxLength={200}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="cf-email" style={labelStyle}>Email *</label>
        <input
          id="cf-email"
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Phone (optional) */}
      <div>
        <label htmlFor="cf-phone" style={labelStyle}>Phone <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
        <input
          id="cf-phone"
          type="tel"
          maxLength={50}
          placeholder="+43 …"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", fontSize: "14px", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          background: submitting ? "#333" : "#D99E4F",
          color: submitting ? "#888" : "#000",
          border: "none",
          borderRadius: "99px",
          padding: "14px 32px",
          fontSize: "14px",
          fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {submitting ? "Submitting…" : "Submit Complaint"}
      </button>
    </form>
  );
}
