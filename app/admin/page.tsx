"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

type OrderStatus =
  | "PENDING" | "PAID" | "SCHEDULED" | "RELEASED" | "CONFIRMED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalAmountCents: number;
  scheduledFor: string | null;
  isScheduled: boolean;
  deliveryMode: "address" | "gps";
  deliveryLat: number | null;
  deliveryLng: number | null;
  createdAt: string;
  updatedAt: string;
  customerNote: string | null;
  customer: { fullName: string; email: string; phone: string | null };
  shipping: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
  items: Array<{
    id: string;
    productName: string;
    productSlug: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
};

// ── Utilities ────────────────────────────────────────────────────────────

function formatEuro(cents: number) {
  return new Intl.NumberFormat("en-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(dateString));
}

function formatStatusLabel(status: OrderStatus) {
  return status.replace(/_/g, " ").charAt(0) + status.replace(/_/g, " ").slice(1).toLowerCase();
}

const LIVE_STATUSES: OrderStatus[] = ["PAID", "RELEASED", "CONFIRMED", "OUT_FOR_DELIVERY"];
const ALL_STATUSES: OrderStatus[] = [
  "PENDING", "PAID", "SCHEDULED", "RELEASED", "CONFIRMED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
];
const PAGE_SIZE = 10;

// ── Inventory ────────────────────────────────────────────────────────────

type ProductStock = {
  slug: string; name: string; stockCount: number; lowStockThreshold: number;
};

function InventoryRow({ product, onSaved }: { product: ProductStock; onSaved: (u: ProductStock) => void }) {
  const [stock, setStock] = useState(String(product.stockCount));
  const [threshold, setThreshold] = useState(String(product.lowStockThreshold));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function saveValues(newStock: string, newThreshold: string) {
    setStatus("saving"); setError(null);
    try {
      const res = await fetch(`/api/products/${product.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCount: Number(newStock), lowStockThreshold: Number(newThreshold) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      onSaved({ ...product, stockCount: data.product.stockCount, lowStockThreshold: data.product.lowStockThreshold });
      setStatus("saved"); setTimeout(() => setStatus("idle"), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed."); setStatus("error"); }
  }

  const isLow = product.stockCount <= product.lowStockThreshold && product.stockCount > 0;
  const isOut = product.stockCount === 0;

  return (
    <div className="admin-item-row" style={{ alignItems: "center", gap: "12px" }}>
      <div style={{ flex: 1 }}>
        <strong>{product.name}</strong>
        {isOut && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#c0392b", fontWeight: 700 }}>OUT OF STOCK</span>}
        {isLow && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#c47a1a", fontWeight: 700 }}>LOW</span>}
        {status === "saving" && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#888" }}>Saving…</span>}
        {status === "saved" && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#5a7a3a" }}>Saved</span>}
        {status === "error" && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#c0392b" }}>{error}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label style={{ fontSize: "12px", color: "#888" }}>Stock</label>
        <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} onBlur={(e) => saveValues(e.target.value, threshold)}
          style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", background: "#111", color: "#fff", fontSize: "14px" }} />
        <label style={{ fontSize: "12px", color: "#888" }}>Alert at</label>
        <input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} onBlur={(e) => saveValues(stock, e.target.value)}
          style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", background: "#111", color: "#fff", fontSize: "14px" }} />
      </div>
    </div>
  );
}

function InventoryPanel() {
  const [productList, setProductList] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(({ products }) => setProductList(products)).finally(() => setLoading(false));
  }, []);

  const lowStockItems = productList.filter((p) => p.stockCount <= p.lowStockThreshold);

  return (
    <section className="admin-toolbar-card" style={{ marginTop: "16px" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600 }}>Inventory</h2>
      {lowStockItems.length > 0 && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(196,122,26,0.12)", border: "1px solid rgba(196,122,26,0.4)", fontSize: "13px", color: "#c47a1a" }}>
          <strong>Low stock: </strong>{lowStockItems.map((p) => `${p.name} (${p.stockCount})`).join(", ")}
        </div>
      )}
      {loading ? <p className="admin-empty-state">Loading…</p> : (
        <div className="admin-items-list">
          {productList.map((p) => <InventoryRow key={p.slug} product={p} onSaved={(u) => setProductList((l) => l.map((x) => x.slug === u.slug ? u : x))} />)}
        </div>
      )}
    </section>
  );
}

// ── Order Detail Panel (with Edit→Save protection) ───────────────────────

function OrderDetailPanel({
  order,
  onUpdate,
}: {
  order: OrderSummary;
  onUpdate: (updated: OrderSummary) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft when a different order is selected
  useEffect(() => {
    setEditMode(false);
    setDraftStatus(order.status);
    setError(null);
  }, [order.id, order.status]);

  async function handleSave() {
    if (draftStatus === order.status) { setEditMode(false); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: draftStatus, changedBy: "owner" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed.");
      onUpdate(data.order);
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-detail-card">
      <div className="admin-detail-header">
        <div>
          <p className="eyebrow">Order</p>
          <h2>{order.orderNumber}</h2>
          <p>{formatDate(order.createdAt)}</p>
          {order.isScheduled && order.scheduledFor && (
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#D99E4F", fontWeight: 600 }}>
              Scheduled: {formatDate(order.scheduledFor)}
            </p>
          )}
        </div>
        <span className={`status-badge status-badge--${order.status.toLowerCase().replace(/_/g, "-")}`}>
          {formatStatusLabel(order.status)}
        </span>
      </div>

      <div className="admin-detail-section">
        <h3>Customer</h3>
        <p>{order.customer.fullName}</p>
        <p>{order.customer.email}</p>
        {order.customer.phone && <p>{order.customer.phone}</p>}
        {order.customerNote && <p style={{ marginTop: "6px", fontSize: "12px", color: "#D99E4F" }}>Note: {order.customerNote}</p>}
      </div>

      <div className="admin-detail-section">
        <h3>Delivery</h3>
        {order.deliveryMode === "gps" && order.deliveryLat != null && order.deliveryLng != null ? (
          <>
            <p style={{ fontSize: "12px", color: "#D99E4F", fontWeight: 600, marginBottom: "8px" }}>GPS Pin</p>
            <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", height: "200px" }}>
              <iframe title="Delivery location" width="100%" height="200" style={{ border: 0, display: "block" }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${order.deliveryLng - 0.005},${order.deliveryLat - 0.003},${order.deliveryLng + 0.005},${order.deliveryLat + 0.003}&layer=mapnik&marker=${order.deliveryLat},${order.deliveryLng}`}
                loading="lazy" />
            </div>
            <a href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", color: "#D99E4F", fontWeight: 600, textDecoration: "underline" }}>
              Open in Google Maps ↗
            </a>
          </>
        ) : (
          <>
            <p>{order.shipping.addressLine1 ?? "—"}</p>
            {order.shipping.addressLine2 && <p>{order.shipping.addressLine2}</p>}
            <p>{order.shipping.postalCode ?? "—"} {order.shipping.city ?? ""}</p>
            <p>{order.shipping.country ?? "—"}</p>
          </>
        )}
      </div>

      <div className="admin-detail-section">
        <h3>Items</h3>
        <div className="admin-items-list">
          {order.items.map((item) => (
            <div key={item.id} className="admin-item-row">
              <div><strong>{item.productName}</strong><p>Qty {item.quantity}</p></div>
              <strong>{formatEuro(item.lineTotalCents)}</strong>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
          <span>Total</span><span style={{ color: "#D99E4F" }}>{formatEuro(order.totalAmountCents)}</span>
        </div>
      </div>

      {/* Edit→Save status change — owner only */}
      <div className="admin-detail-section">
        <h3>Status</h3>
        {!editMode ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className={`status-badge status-badge--${order.status.toLowerCase().replace(/_/g, "-")}`}>
              {formatStatusLabel(order.status)}
            </span>
            <button type="button" className="admin-page-button" onClick={() => setEditMode(true)} style={{ marginLeft: "auto" }}>
              Edit
            </button>
          </div>
        ) : (
          <div>
            <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as OrderStatus)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "#111", color: "#fff", fontSize: "14px", marginBottom: "10px" }}>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{formatStatusLabel(s)}{s === order.status ? " (current)" : ""}</option>
              ))}
            </select>
            {error && <p style={{ fontSize: "12px", color: "#c0392b", marginBottom: "8px" }}>{error}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="submit-button" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="admin-page-button" onClick={() => { setEditMode(false); setDraftStatus(order.status); setError(null); }} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orders List ───────────────────────────────────────────────────────────

function OrderRow({
  order,
  isSelected,
  onClick,
}: {
  order: OrderSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`admin-order-row${isSelected ? " is-active" : ""}`} onClick={onClick}>
      <div className="admin-order-row-top">
        <strong>{order.orderNumber}</strong>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {order.deliveryMode === "gps" && (
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#D99E4F", background: "rgba(217,158,79,0.12)", padding: "2px 6px", borderRadius: "4px" }}>GPS</span>
          )}
          {order.isScheduled && (
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#6c8ebf", background: "rgba(108,142,191,0.12)", padding: "2px 6px", borderRadius: "4px" }}>SCHED</span>
          )}
          <span className={`status-badge status-badge--${order.status.toLowerCase().replace(/_/g, "-")}`}>
            {formatStatusLabel(order.status)}
          </span>
        </span>
      </div>
      <p>{order.customer.fullName}</p>
      {order.isScheduled && order.scheduledFor && (
        <p style={{ fontSize: "11px", color: "#D99E4F" }}>📅 {formatDate(order.scheduledFor)}</p>
      )}
      <div className="admin-order-row-bottom">
        <span>{formatDate(order.createdAt)}</span>
        <strong>{formatEuro(order.totalAmountCents)}</strong>
      </div>
    </button>
  );
}

// ── Live Orders Section ───────────────────────────────────────────────────

function LiveOrdersSection() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);

    const searchParams = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) searchParams.set("q", query);
    // Filter to live statuses only
    // We load all live statuses by fetching without status filter and filtering client-side
    // (simpler than multiple fetches). For large deployments, a dedicated endpoint is better.
    fetch(`/api/orders?${searchParams}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) { setError(data.error ?? "Failed to load."); return; }
        const liveOrders = (data.orders as OrderSummary[]).filter((o) => LIVE_STATUSES.includes(o.status) || o.status === "PENDING");
        setOrders(liveOrders);
        setTotalCount(data.pagination.totalCount);
        setPageCount(data.pagination.pageCount);
        if (!selectedOrderId && liveOrders.length > 0) {
          setSelectedOrderId(liveOrders[0].id);
          setSelectedOrder(liveOrders[0]);
        }
      })
      .catch(() => { if (!cancelled) setError("Failed to load orders."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, query, selectedOrderId]);

  function handleOrderUpdate(updated: OrderSummary) {
    setOrders((curr) => curr.map((o) => o.id === updated.id ? updated : o));
    if (selectedOrderId === updated.id) setSelectedOrder(updated);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Live Orders</h2>
        <span style={{ fontSize: "12px", color: "#888" }}>Active now — requires action</span>
      </div>

      <form style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
        onSubmit={(e: FormEvent) => { e.preventDefault(); setPage(1); setQuery(draftQuery.trim()); }}>
        <input value={draftQuery} onChange={(e) => setDraftQuery(e.target.value)} placeholder="Search orders…"
          style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "#111", color: "#fff", fontSize: "14px" }} />
        <button type="submit" className="admin-page-button">Search</button>
      </form>

      {error && <p style={{ color: "#c0392b", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

      <section className="admin-grid">
        <div className="admin-list-card">
          <div className="admin-list-header">
            <h2>Orders ({totalCount})</h2>
            <p>Page {page} of {pageCount}</p>
          </div>
          {loading ? <p className="admin-empty-state">Loading…</p> : orders.length === 0 ? (
            <p className="admin-empty-state">No live orders right now.</p>
          ) : (
            <div className="admin-order-list">
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} isSelected={selectedOrderId === o.id}
                  onClick={() => { setSelectedOrderId(o.id); setSelectedOrder(o); }} />
              ))}
            </div>
          )}
          <div className="admin-pagination">
            <button type="button" className="admin-page-button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Previous</button>
            <button type="button" className="admin-page-button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount || loading}>Next</button>
          </div>
        </div>

        <div>
          {selectedOrder ? (
            <OrderDetailPanel order={selectedOrder} onUpdate={handleOrderUpdate} />
          ) : (
            <div className="admin-detail-card"><p className="admin-empty-state">Select an order to inspect it.</p></div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Scheduled Orders Section ──────────────────────────────────────────────

type ScheduledDay = {
  dateLabel: string;
  orders: OrderSummary[];
};

function ScheduledOrdersSection() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch("/api/orders?status=SCHEDULED&pageSize=50", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setOrders(data.orders as OrderSummary[]);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleOrderUpdate(updated: OrderSummary) {
    setOrders((curr) => curr.map((o) => o.id === updated.id ? updated : o));
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  }

  // Group orders by calendar day
  const groupedDays = useMemo<ScheduledDay[]>(() => {
    const map = new Map<string, OrderSummary[]>();
    for (const o of orders) {
      if (!o.scheduledFor) continue;
      const label = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(o.scheduledFor));
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(o);
    }
    return [...map.entries()].map(([dateLabel, dayOrders]) => ({ dateLabel, orders: dayOrders.sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()) }));
  }, [orders]);

  function toggleDay(label: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  if (loading) return <p className="admin-empty-state">Loading scheduled orders…</p>;
  if (orders.length === 0) return <p className="admin-empty-state">No scheduled future orders.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#6c8ebf", flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Scheduled Orders</h2>
        <span style={{ fontSize: "12px", color: "#888" }}>Future orders — auto-released by cron</span>
      </div>

      <section className="admin-grid">
        <div className="admin-list-card">
          {groupedDays.map(({ dateLabel, orders: dayOrders }) => {
            const isExpanded = expandedDays.has(dateLabel);
            return (
              <div key={dateLabel} style={{ marginBottom: "8px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", overflow: "hidden" }}>
                <button type="button" onClick={() => toggleDay(dateLabel)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(108,142,191,0.08)", border: "none", color: "#fff", cursor: "pointer", fontSize: "14px" }}>
                  <span style={{ fontWeight: 600 }}>{dateLabel}</span>
                  <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#888" }}>{dayOrders.length} orders</span>
                    <span style={{ color: "#888" }}>{isExpanded ? "▲" : "▼"}</span>
                  </span>
                </button>
                {isExpanded && (
                  <div className="admin-order-list" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {dayOrders.map((o) => (
                      <OrderRow key={o.id} order={o} isSelected={selectedOrder?.id === o.id}
                        onClick={() => setSelectedOrder(o)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          {selectedOrder ? (
            <OrderDetailPanel order={selectedOrder} onUpdate={handleOrderUpdate} />
          ) : (
            <div className="admin-detail-card"><p className="admin-empty-state">Select a scheduled order.</p></div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Complaints Section ────────────────────────────────────────────────────

type ComplaintStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";
type ComplaintCategory = "LATE_DELIVERY" | "WRONG_ORDER" | "QUALITY" | "OTHER";

type ComplaintItem = {
  id: string;
  status: ComplaintStatus;
  category: ComplaintCategory;
  subject: string;
  message: string;
  name: string;
  email: string;
  phone: string | null;
  adminNote: string | null;
  orderNumber: string | null;
  createdAt: string;
};

const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
};

const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  LATE_DELIVERY: "Late Delivery",
  WRONG_ORDER: "Wrong Order",
  QUALITY: "Quality Issue",
  OTHER: "Other",
};

const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  OPEN: "#EF4444",
  IN_REVIEW: "#D99E4F",
  RESOLVED: "#4caf50",
};

function ComplaintRow({
  complaint,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  complaint: ComplaintItem;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updated: ComplaintItem) => void;
}) {
  const [draftStatus, setDraftStatus] = useState<ComplaintStatus>(complaint.status);
  const [draftNote, setDraftNote] = useState(complaint.adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraftStatus(complaint.status);
    setDraftNote(complaint.adminNote ?? "");
  }, [complaint.id, complaint.status, complaint.adminNote]);

  async function handleSave() {
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: draftStatus, adminNote: draftNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      onUpdate({ ...complaint, status: data.status, adminNote: data.adminNote });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setSaving(false);
    }
  }

  const statusColor = COMPLAINT_STATUS_COLORS[complaint.status];

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", overflow: "hidden", marginBottom: "8px" }}>
      <button type="button" onClick={onToggle}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "none", color: "#fff", cursor: "pointer", gap: "12px", textAlign: "left" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{complaint.subject}</div>
          <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>
            {complaint.name} · {COMPLAINT_CATEGORY_LABELS[complaint.category]}
            {complaint.orderNumber && ` · Order ${complaint.orderNumber}`}
            {" · "}{new Date(complaint.createdAt).toLocaleDateString("de-AT")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
            {COMPLAINT_STATUS_LABELS[complaint.status]}
          </span>
          <span style={{ color: "#888" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {isExpanded && (
        <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "13px", color: "#e2ddd6", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{complaint.message}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
            <div><span style={{ color: "#525252" }}>Email: </span>{complaint.email}</div>
            {complaint.phone && <div><span style={{ color: "#525252" }}>Phone: </span>{complaint.phone}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "11px", color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em" }}>Admin Note</label>
            <textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={3}
              style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2ddd6", fontSize: "13px", padding: "10px 12px", resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as ComplaintStatus)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "#111", color: "#fff", fontSize: "13px" }}>
              {(["OPEN", "IN_REVIEW", "RESOLVED"] as ComplaintStatus[]).map((s) => (
                <option key={s} value={s}>{COMPLAINT_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: saving ? "#333" : "#D99E4F", color: saving ? "#888" : "#000", fontWeight: 700, fontSize: "13px", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            {saveError && <span style={{ fontSize: "12px", color: "#EF4444" }}>{saveError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintsSection() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / 20));

  useEffect(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    fetch(`/api/complaints?${params}`)
      .then((r) => r.json())
      .then((data) => { setComplaints(data.complaints); setTotal(data.total); })
      .catch(() => setError("Failed to load complaints."))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  function handleUpdate(updated: ComplaintItem) {
    setComplaints((curr) => curr.map((c) => c.id === updated.id ? updated : c));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Complaints</h2>
        <span style={{ fontSize: "12px", color: "#888" }}>Customer-submitted issues</span>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((s) => (
          <button key={s} type="button" onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{ padding: "6px 14px", borderRadius: "99px", border: `1px solid ${statusFilter === s ? "rgba(217,158,79,0.6)" : "rgba(255,255,255,0.1)"}`, background: statusFilter === s ? "rgba(217,158,79,0.12)" : "transparent", color: statusFilter === s ? "#D99E4F" : "#888", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            {s === "ALL" ? "All" : COMPLAINT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "#c0392b", fontSize: "13px" }}>{error}</p>}

      {loading ? (
        <p className="admin-empty-state">Loading…</p>
      ) : complaints.length === 0 ? (
        <p className="admin-empty-state">No complaints {statusFilter !== "ALL" ? `with status "${COMPLAINT_STATUS_LABELS[statusFilter]}"` : "yet"}.</p>
      ) : (
        <>
          <div style={{ marginBottom: "8px", fontSize: "13px", color: "#888" }}>{total} total</div>
          {complaints.map((c) => (
            <ComplaintRow key={c.id} complaint={c}
              isExpanded={expandedId === c.id}
              onToggle={() => setExpandedId((prev) => prev === c.id ? null : c.id)}
              onUpdate={handleUpdate} />
          ))}
          <div className="admin-pagination" style={{ marginTop: "16px" }}>
            <button type="button" className="admin-page-button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Previous</button>
            <span style={{ fontSize: "13px", color: "#888" }}>Page {page} of {pageCount}</span>
            <button type="button" className="admin-page-button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount || loading}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

type AdminSection = "live" | "scheduled" | "complaints";

const SECTION_CONFIG: Record<AdminSection, { label: string; color: string; bg: string }> = {
  live: { label: "Live Orders", color: "#4caf50", bg: "rgba(76,175,80,0.2)" },
  scheduled: { label: "Scheduled", color: "#6c8ebf", bg: "rgba(108,142,191,0.2)" },
  complaints: { label: "Complaints", color: "#EF4444", bg: "rgba(239,68,68,0.2)" },
};

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>("live");

  return (
    <main className="admin-shell">
      <section className="admin-header-card">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="admin-title">Dashboard</h1>
          <p className="admin-subtitle">Manage orders, inventory, and your business.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <a href="/admin/restaurant" style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(217,158,79,0.12)", color: "#D99E4F", fontSize: "13px", fontWeight: 600, textDecoration: "none", border: "1px solid rgba(217,158,79,0.3)" }}>
            Restaurant View ↗
          </a>
          <a href="/admin/driver" style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#ccc", fontSize: "13px", fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)" }}>
            Driver View ↗
          </a>
        </div>
      </section>

      <InventoryPanel />

      {/* Section tabs */}
      <div style={{ display: "flex", gap: "4px", marginTop: "24px", marginBottom: "16px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "4px" }}>
        {(Object.keys(SECTION_CONFIG) as AdminSection[]).map((s) => {
          const cfg = SECTION_CONFIG[s];
          return (
            <button key={s} type="button" onClick={() => setActiveSection(s)}
              style={{ flex: 1, padding: "10px 16px", borderRadius: "9px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "14px", transition: "all 0.15s",
                background: activeSection === s ? cfg.bg : "transparent",
                color: activeSection === s ? cfg.color : "#888" }}>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {activeSection === "live" && <LiveOrdersSection />}
      {activeSection === "scheduled" && <ScheduledOrdersSection />}
      {activeSection === "complaints" && <ComplaintsSection />}
    </main>
  );
}
