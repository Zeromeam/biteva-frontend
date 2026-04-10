"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

type OrderStatus =
  | "PENDING" | "PAID" | "SCHEDULED" | "RELEASED" | "CONFIRMED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

type QueueOrder = {
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
  shippingCity: string | null;
  customerNote: string | null;
  customer: { fullName: string; phone: string | null };
  items: Array<{ id: string; productName: string; quantity: number; lineTotalCents: number }>;
};

type BigDay = {
  date: string;
  orderCount: number;
  totalItems: number;
  topItems: Array<{ name: string; quantity: number }>;
  isAcked: boolean;
  ackedAt: string | null;
};

// ── Utilities ─────────────────────────────────────────────────────────────

function formatEuro(cents: number) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatTime(dateString: string | null) {
  if (!dateString) return "ASAP";
  return new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" }).format(new Date(dateString));
}

function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateString));
}

const STATUS_NEXT: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  RELEASED: { label: "Mark Confirmed", next: "CONFIRMED" },
  CONFIRMED: { label: "Mark Out for Delivery", next: "OUT_FOR_DELIVERY" },
  OUT_FOR_DELIVERY: { label: "Mark Delivered", next: "DELIVERED" },
  PAID: { label: "Mark Confirmed", next: "CONFIRMED" },
};

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  RELEASED: "#D99E4F",
  CONFIRMED: "#4caf50",
  OUT_FOR_DELIVERY: "#6c8ebf",
  PAID: "#aaa",
};

// ── Order Card ────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onStatusChange,
  updating,
}: {
  order: QueueOrder;
  onStatusChange: (orderId: string, next: OrderStatus) => void;
  updating: boolean;
}) {
  const nextAction = STATUS_NEXT[order.status];
  const statusColor = STATUS_COLORS[order.status] ?? "#888";

  return (
    <div style={{
      background: "#111", border: `1px solid ${statusColor}33`, borderLeft: `3px solid ${statusColor}`,
      borderRadius: "12px", padding: "16px", marginBottom: "10px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: "15px" }}>{order.orderNumber}</span>
          {order.isScheduled && order.scheduledFor && (
            <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#D99E4F", background: "rgba(217,158,79,0.15)", padding: "2px 7px", borderRadius: "4px" }}>
              {formatTime(order.scheduledFor)}
            </span>
          )}
          {!order.isScheduled && (
            <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#4caf50", background: "rgba(76,175,80,0.15)", padding: "2px 7px", borderRadius: "4px" }}>
              ASAP
            </span>
          )}
        </div>
        <span style={{ fontSize: "12px", color: statusColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      <div style={{ fontSize: "13px", color: "#ccc", marginBottom: "8px" }}>
        <span style={{ fontWeight: 600 }}>{order.shippingFullName ?? order.customer.fullName}</span>
        {order.shippingPhone && <span style={{ marginLeft: "8px", color: "#888" }}>{order.shippingPhone}</span>}
      </div>

      {/* Delivery info */}
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
        {order.deliveryMode === "gps" && order.deliveryLat && order.deliveryLng ? (
          <a href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`} target="_blank" rel="noopener noreferrer"
            style={{ color: "#D99E4F", fontWeight: 600, textDecoration: "underline" }}>
            Open GPS in Maps ↗
          </a>
        ) : (
          <span>{order.shippingAddressLine1 ?? "—"}{order.shippingCity ? `, ${order.shippingCity}` : ""}</span>
        )}
      </div>

      {/* Items */}
      <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "10px" }}>
        {order.items.map((item) => (
          <span key={item.id} style={{ display: "inline-block", marginRight: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", padding: "2px 6px" }}>
            {item.quantity}× {item.productName}
          </span>
        ))}
      </div>

      {order.customerNote && (
        <div style={{ fontSize: "12px", color: "#D99E4F", marginBottom: "10px", padding: "6px 10px", background: "rgba(217,158,79,0.08)", borderRadius: "6px" }}>
          Note: {order.customerNote}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: "#D99E4F" }}>{formatEuro(order.totalAmountCents)}</span>
        {nextAction && (
          <button type="button" onClick={() => onStatusChange(order.id, nextAction.next)} disabled={updating}
            style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#D99E4F", color: "#000", fontWeight: 700, fontSize: "13px", cursor: updating ? "not-allowed" : "pointer", opacity: updating ? 0.6 : 1 }}>
            {updating ? "Updating…" : nextAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Big Days Side Panel ───────────────────────────────────────────────────

function BigDaysPanel() {
  const [bigDays, setBigDays] = useState<BigDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingDate, setAckingDate] = useState<string | null>(null);

  const loadBigDays = useCallback(() => {
    fetch("/api/admin/big-days", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (data.ok) setBigDays(data.bigDays); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBigDays(); }, [loadBigDays]);

  async function acknowledge(date: string) {
    setAckingDate(date);
    try {
      await fetch("/api/admin/big-day-ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date(date).toISOString() }),
      });
      loadBigDays();
    } finally {
      setAckingDate(null);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  return (
    <div style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "20px", height: "fit-content", position: "sticky", top: "20px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700 }}>Big Days</h2>
      <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#666" }}>Days with high order volume</p>

      {loading ? (
        <p style={{ fontSize: "13px", color: "#666" }}>Loading…</p>
      ) : bigDays.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#666" }}>No busy days coming up.</p>
      ) : (
        bigDays.map((day) => {
          const dateStr = day.date.slice(0, 10);
          const isTomorrow = dateStr === tomorrowStr;
          const canAck = !day.isAcked && isTomorrow;

          return (
            <div key={day.date} style={{
              background: "#111", border: day.isAcked ? "1px solid rgba(76,175,80,0.3)" : "1px solid rgba(217,158,79,0.4)",
              borderRadius: "10px", padding: "14px", marginBottom: "10px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>{formatShortDate(day.date)}</span>
                {day.isAcked ? (
                  <span style={{ fontSize: "11px", color: "#4caf50", fontWeight: 700 }}>✓ Acknowledged</span>
                ) : (
                  <span style={{ fontSize: "11px", color: "#c47a1a", fontWeight: 700 }}>⚠ Pending</span>
                )}
              </div>

              <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "8px" }}>
                {day.orderCount} orders · {day.totalItems} items
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: canAck ? "10px" : "0" }}>
                {day.topItems.map((item) => (
                  <span key={item.name} style={{ fontSize: "11px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", padding: "2px 6px", color: "#ccc" }}>
                    {item.quantity}× {item.name}
                  </span>
                ))}
              </div>

              {canAck && (
                <button type="button" onClick={() => acknowledge(day.date)} disabled={ackingDate === day.date}
                  style={{ width: "100%", padding: "8px", borderRadius: "7px", border: "none", background: "#D99E4F", color: "#000", fontWeight: 700, fontSize: "13px", cursor: ackingDate === day.date ? "not-allowed" : "pointer" }}>
                  {ackingDate === day.date ? "Confirming…" : "Acknowledge"}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Main Restaurant Page ──────────────────────────────────────────────────

type QueueResponse = {
  ok: true;
  activeQueue: QueueOrder[];
  comingToday: QueueOrder[];
  tomorrow: QueueOrder[];
  upcoming: QueueOrder[];
  counts: { activeQueue: number; comingToday: number; tomorrow: number; upcoming: number };
};

type QueueSection = "active" | "today" | "tomorrow" | "upcoming";

export default function RestaurantPage() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<QueueSection>("active");
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    fetch("/api/admin/queue", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (data.ok) setQueue(data); else setError("Failed to load queue."); })
      .catch(() => setError("Failed to load queue."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadQueue();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadQueue, 30_000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, changedBy: "restaurant" }),
      });
      if (res.ok) loadQueue();
      else setError("Failed to update order.");
    } catch { setError("Failed to update order."); }
    finally { setUpdatingId(null); }
  }

  const sectionOrders: Record<QueueSection, QueueOrder[]> = {
    active: queue?.activeQueue ?? [],
    today: queue?.comingToday ?? [],
    tomorrow: queue?.tomorrow ?? [],
    upcoming: queue?.upcoming ?? [],
  };

  const sectionLabels: Record<QueueSection, string> = {
    active: `Active (${queue?.counts.activeQueue ?? 0})`,
    today: `Coming Today (${queue?.counts.comingToday ?? 0})`,
    tomorrow: `Tomorrow (${queue?.counts.tomorrow ?? 0})`,
    upcoming: `Upcoming (${queue?.counts.upcoming ?? 0})`,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ margin: 0, fontSize: "11px", color: "#666", letterSpacing: "0.15em", textTransform: "uppercase" }}>Kitchen</p>
          <h1 style={{ margin: "4px 0 0", fontSize: "24px", fontWeight: 700, color: "#D99E4F", fontStyle: "italic" }}>Biteva</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" onClick={loadQueue}
            style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#888", fontSize: "13px", cursor: "pointer" }}>
            ↻ Refresh
          </button>
          <a href="/admin" style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: "13px", textDecoration: "none" }}>
            Admin ↗
          </a>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.4)", color: "#c0392b", fontSize: "13px", marginBottom: "16px" }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: "8px", background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}>
        {/* Main panel */}
        <div>
          {/* Section tabs */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "4px" }}>
            {(["active", "today", "tomorrow", "upcoming"] as QueueSection[]).map((s) => (
              <button key={s} type="button" onClick={() => setActiveSection(s)}
                style={{ flex: 1, padding: "8px 4px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                  background: activeSection === s ? "rgba(217,158,79,0.2)" : "transparent",
                  color: activeSection === s ? "#D99E4F" : "#666" }}>
                {sectionLabels[s]}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>Loading queue…</p>
          ) : sectionOrders[activeSection].length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                {activeSection === "active" ? "✓" : "○"}
              </div>
              <p style={{ fontSize: "14px" }}>
                {activeSection === "active" ? "No active orders right now." : "No orders in this period."}
              </p>
            </div>
          ) : (
            sectionOrders[activeSection].map((order) => (
              <OrderCard key={order.id} order={order} updating={updatingId === order.id}
                onStatusChange={handleStatusChange} />
            ))
          )}
        </div>

        {/* Big days side panel */}
        <BigDaysPanel />
      </div>
    </main>
  );
}
