"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────

type OrderStatus =
  | "PENDING" | "PAID" | "SCHEDULED" | "RELEASED" | "CONFIRMED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

type DriverOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmountCents: number;
  scheduledFor: string | null;
  isScheduled: boolean;
  deliveryMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  shippingFullName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  customerNote: string | null;
  driverNote: string | null;
  customer: { fullName: string; phone: string | null };
  items: Array<{ id: string; productName: string; quantity: number }>;
};

// ── Utilities ─────────────────────────────────────────────────────────────

function formatEuro(cents: number) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatTime(dateString: string | null) {
  if (!dateString) return "ASAP";
  return new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" }).format(new Date(dateString));
}

// ── Driver Order Card ─────────────────────────────────────────────────────

function DriverOrderCard({
  order,
  onStatusChange,
  updating,
}: {
  order: DriverOrder;
  onStatusChange: (id: string, status: OrderStatus, note?: string) => void;
  updating: boolean;
}) {
  const [showProblemInput, setShowProblemInput] = useState(false);
  const [problemNote, setProblemNote] = useState("");

  const isReadyForPickup = order.status === "RELEASED" || order.status === "CONFIRMED";
  const isOutForDelivery = order.status === "OUT_FOR_DELIVERY";

  return (
    <div style={{
      background: "#111", border: `1px solid ${isOutForDelivery ? "rgba(108,142,191,0.4)" : "rgba(255,255,255,0.08)"}`,
      borderLeft: `3px solid ${isOutForDelivery ? "#6c8ebf" : "#D99E4F"}`,
      borderRadius: "14px", padding: "18px", marginBottom: "12px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>{order.orderNumber}</span>
          <span style={{ marginLeft: "10px", fontSize: "12px", color: isOutForDelivery ? "#6c8ebf" : "#D99E4F", fontWeight: 700,
            background: isOutForDelivery ? "rgba(108,142,191,0.15)" : "rgba(217,158,79,0.15)", padding: "2px 8px", borderRadius: "4px" }}>
            {isOutForDelivery ? "Out for delivery" : "Ready for pickup"}
          </span>
        </div>
        {order.isScheduled && order.scheduledFor && (
          <span style={{ fontSize: "12px", color: "#888" }}>{formatTime(order.scheduledFor)}</span>
        )}
      </div>

      {/* Customer */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "14px" }}>
          {order.shippingFullName ?? order.customer.fullName}
        </p>
        {(order.shippingPhone ?? order.customer.phone) && (
          <a href={`tel:${order.shippingPhone ?? order.customer.phone}`}
            style={{ fontSize: "14px", color: "#D99E4F", fontWeight: 600, textDecoration: "none" }}>
            📞 {order.shippingPhone ?? order.customer.phone}
          </a>
        )}
      </div>

      {/* Delivery address / GPS */}
      <div style={{ marginBottom: "12px" }}>
        {order.deliveryMode === "gps" && order.deliveryLat && order.deliveryLng ? (
          <a href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: "12px", borderRadius: "10px", background: "rgba(217,158,79,0.1)", border: "1px solid rgba(217,158,79,0.3)", color: "#D99E4F", fontWeight: 700, fontSize: "14px", textDecoration: "none", textAlign: "center" }}>
            📍 Open GPS Location in Maps ↗
          </a>
        ) : (
          <div style={{ fontSize: "14px", color: "#ccc" }}>
            <p style={{ margin: "0 0 2px" }}>{order.shippingAddressLine1 ?? "—"}</p>
            {order.shippingAddressLine2 && <p style={{ margin: "0 0 2px", color: "#888" }}>{order.shippingAddressLine2}</p>}
            <p style={{ margin: 0, color: "#888" }}>
              {[order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" ")}
            </p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([order.shippingAddressLine1, order.shippingCity].filter(Boolean).join(", "))}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", color: "#D99E4F", fontWeight: 600, textDecoration: "underline" }}>
              Open in Google Maps ↗
            </a>
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "12px" }}>
        {order.items.map((item) => (
          <span key={item.id} style={{ display: "inline-block", marginRight: "6px", marginBottom: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", padding: "2px 8px" }}>
            {item.quantity}× {item.productName}
          </span>
        ))}
      </div>

      {order.customerNote && (
        <div style={{ fontSize: "12px", color: "#D99E4F", marginBottom: "12px", padding: "8px 10px", background: "rgba(217,158,79,0.08)", borderRadius: "6px" }}>
          Customer note: {order.customerNote}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontWeight: 700, color: "#D99E4F", fontSize: "16px" }}>{formatEuro(order.totalAmountCents)}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
        {isReadyForPickup && (
          <button type="button" onClick={() => onStatusChange(order.id, "OUT_FOR_DELIVERY")} disabled={updating}
            style={{ width: "100%", padding: "12px", borderRadius: "9px", border: "none", background: "#6c8ebf", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: updating ? "not-allowed" : "pointer", opacity: updating ? 0.6 : 1 }}>
            {updating ? "Updating…" : "Picked Up — Start Delivery"}
          </button>
        )}

        {isOutForDelivery && (
          <button type="button" onClick={() => onStatusChange(order.id, "DELIVERED")} disabled={updating}
            style={{ width: "100%", padding: "12px", borderRadius: "9px", border: "none", background: "#4caf50", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: updating ? "not-allowed" : "pointer", opacity: updating ? 0.6 : 1 }}>
            {updating ? "Updating…" : "Delivered ✓"}
          </button>
        )}

        {!showProblemInput && (
          <button type="button" onClick={() => setShowProblemInput(true)} disabled={updating}
            style={{ width: "100%", padding: "10px", borderRadius: "9px", border: "1px solid rgba(192,57,43,0.4)", background: "transparent", color: "#c0392b", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
            Problem with delivery
          </button>
        )}

        {showProblemInput && (
          <div>
            <textarea value={problemNote} onChange={(e) => setProblemNote(e.target.value)} placeholder="Describe the problem…"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(192,57,43,0.4)", background: "#0a0a0a", color: "#fff", fontSize: "13px", minHeight: "70px", marginBottom: "8px", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={() => onStatusChange(order.id, "CANCELLED", problemNote)} disabled={updating || !problemNote.trim()}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#c0392b", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                {updating ? "Saving…" : "Report Problem"}
              </button>
              <button type="button" onClick={() => setShowProblemInput(false)}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: "13px", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Driver Page ──────────────────────────────────────────────────────

export default function DriverPage() {
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    // Fetch orders that a driver needs to see: RELEASED, CONFIRMED, OUT_FOR_DELIVERY
    Promise.all([
      fetch("/api/orders?status=RELEASED&pageSize=50", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/orders?status=CONFIRMED&pageSize=50", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/orders?status=OUT_FOR_DELIVERY&pageSize=50", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([released, confirmed, outForDelivery]) => {
        const all: DriverOrder[] = [
          ...(released.ok ? released.orders : []),
          ...(confirmed.ok ? confirmed.orders : []),
          ...(outForDelivery.ok ? outForDelivery.orders : []),
        ].sort((a, b) => {
          // OUT_FOR_DELIVERY first, then by scheduled time
          if (a.status === "OUT_FOR_DELIVERY" && b.status !== "OUT_FOR_DELIVERY") return -1;
          if (b.status === "OUT_FOR_DELIVERY" && a.status !== "OUT_FOR_DELIVERY") return 1;
          return new Date(a.scheduledFor ?? a.createdAt).getTime() - new Date(b.scheduledFor ?? b.createdAt).getTime();
        });
        setOrders(all);
      })
      .catch(() => setError("Failed to load deliveries."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus, note?: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, changedBy: "driver", note: note ?? undefined }),
      });
      if (res.ok) {
        loadOrders();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to update.");
      }
    } catch { setError("Failed to update."); }
    finally { setUpdatingId(null); }
  }

  const activeDeliveries = orders.filter((o) => o.status === "OUT_FOR_DELIVERY");
  const pendingPickup = orders.filter((o) => o.status === "RELEASED" || o.status === "CONFIRMED");

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p style={{ margin: 0, fontSize: "11px", color: "#666", letterSpacing: "0.15em", textTransform: "uppercase" }}>Driver</p>
          <h1 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: 700, color: "#D99E4F", fontStyle: "italic" }}>Biteva</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={loadOrders}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: "13px", cursor: "pointer" }}>
            ↻
          </button>
          <a href="/admin" style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: "13px", textDecoration: "none" }}>
            Admin
          </a>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.4)", color: "#c0392b", fontSize: "13px", marginBottom: "16px" }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: "8px", background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#666", textAlign: "center", padding: "60px 0" }}>Loading deliveries…</p>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#444" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>✓</div>
          <p style={{ fontSize: "15px" }}>No active deliveries.</p>
        </div>
      ) : (
        <>
          {activeDeliveries.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 12px", fontSize: "13px", color: "#6c8ebf", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Active Delivery ({activeDeliveries.length})
              </h2>
              {activeDeliveries.map((o) => (
                <DriverOrderCard key={o.id} order={o} updating={updatingId === o.id} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}

          {pendingPickup.length > 0 && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: "13px", color: "#D99E4F", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Ready for Pickup ({pendingPickup.length})
              </h2>
              {pendingPickup.map((o) => (
                <DriverOrderCard key={o.id} order={o} updating={updatingId === o.id} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
