"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

// ── Inventory ────────────────────────────────────────────────────────────

type ProductStock = {
  slug: string;
  name: string;
  stockCount: number;
  lowStockThreshold: number;
};

function InventoryRow({ product, onSaved }: { product: ProductStock; onSaved: (updated: ProductStock) => void }) {
  const [stock, setStock] = useState(String(product.stockCount));
  const [threshold, setThreshold] = useState(String(product.lowStockThreshold));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function saveValues(newStock: string, newThreshold: string) {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockCount: Number(newStock),
          lowStockThreshold: Number(newThreshold),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      onSaved({ ...product, stockCount: data.product.stockCount, lowStockThreshold: data.product.lowStockThreshold });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
      setStatus("error");
    }
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
        <input
          type="number" min={0} value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={(e) => saveValues(e.target.value, threshold)}
          style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", background: "#111", color: "#fff", fontSize: "14px" }}
        />
        <label style={{ fontSize: "12px", color: "#888" }}>Alert at</label>
        <input
          type="number" min={0} value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          onBlur={(e) => saveValues(stock, e.target.value)}
          style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", background: "#111", color: "#fff", fontSize: "14px" }}
        />
      </div>
    </div>
  );
}

function InventoryPanel() {
  const [productList, setProductList] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(({ products }) => setProductList(products))
      .finally(() => setLoading(false));
  }, []);

  const lowStockItems = productList.filter(
    (p) => p.stockCount <= p.lowStockThreshold
  );

  function handleSaved(updated: ProductStock) {
    setProductList((list) => list.map((p) => (p.slug === updated.slug ? updated : p)));
  }

  return (
    <section className="admin-toolbar-card" style={{ marginTop: "16px" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600 }}>Inventory</h2>

      {lowStockItems.length > 0 && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(196,122,26,0.12)", border: "1px solid rgba(196,122,26,0.4)", fontSize: "13px", color: "#c47a1a" }}>
          <strong>Low stock alert: </strong>
          {lowStockItems.map((p) => `${p.name} (${p.stockCount} left)`).join(", ")}
        </div>
      )}

      {loading ? (
        <p className="admin-empty-state">Loading inventory…</p>
      ) : (
        <div className="admin-items-list">
          {productList.map((p) => (
            <InventoryRow key={p.slug} product={p} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </section>
  );
}

type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalAmountCents: number;
  deliveryMode: "address" | "gps";
  deliveryLat: number | null;
  deliveryLng: number | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    fullName: string;
    email: string;
    phone: string | null;
  };
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

type OrdersResponse = {
  ok: true;
  orders: OrderSummary[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    totalCount: number;
  };
};

type SingleOrderResponse = {
  ok: true;
  order: OrderSummary;
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS: Array<"ALL" | OrderStatus> = [
  "ALL",
  "PENDING",
  "PAID",
  "CANCELLED",
];

function formatEuro(cents: number) {
  return new Intl.NumberFormat("en-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-AT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatStatusLabel(status: OrderStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function AdminOrdersPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | OrderStatus>("ALL");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const activeFiltersLabel = useMemo(() => {
    const parts = [];

    if (query) {
      parts.push(`search: ${query}`);
    }

    if (status !== "ALL") {
      parts.push(`status: ${formatStatusLabel(status)}`);
    }

    return parts.length > 0 ? parts.join(" • ") : "All orders";
  }, [query, status]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (query) {
          searchParams.set("q", query);
        }

        if (status !== "ALL") {
          searchParams.set("status", status);
        }

        const response = await fetch(`/api/orders?${searchParams.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as OrdersResponse | { error?: string };


        if (!response.ok || !("ok" in data)) {
          const message = "error" in data ? data.error : undefined;
          throw new Error(message ?? "Could not load orders.");
        }
        if (cancelled) {
          return;
        }

        setOrders(data.orders);
        setTotalCount(data.pagination.totalCount);
        setPageCount(data.pagination.pageCount);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setOrders([]);
        setSelectedOrderId(null);
        setSelectedOrder(null);
        setTotalCount(0);
        setPageCount(1);
        setError(
          loadError instanceof Error ? loadError.message : "Could not load orders."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [page, query, status]);

  useEffect(() => {
    if (orders.length === 0) {
      setSelectedOrder(null);
      setSelectedOrderId(null);
      return;
    }

    if (!selectedOrderId) {
      setSelectedOrderId(orders[0].id);
      setSelectedOrder(orders[0]);
      return;
    }

    const matchingOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
    setSelectedOrder(matchingOrder ?? orders[0]);

    if (!matchingOrder) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  async function refreshSelectedOrder(orderId: string) {
    const response = await fetch(`/api/orders/${orderId}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as SingleOrderResponse | { error?: string };


    if (!response.ok || !("ok" in data)) {
      const message = "error" in data ? data.error : undefined;
      throw new Error(message ?? "Could not refresh the order.");
    }
    setSelectedOrder(data.order);
    setOrders((current) =>
      current.map((order) => (order.id === data.order.id ? data.order : order))
    );
  }

  async function updateStatus(orderId: string, nextStatus: OrderStatus) {
    setUpdatingOrderId(orderId);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await response.json()) as SingleOrderResponse | { error?: string };

      if (!response.ok || !("ok" in data)) {
        const message = "error" in data ? data.error : undefined;
        throw new Error(message ?? "Could not update the order.");
      }
      setOrders((current) =>
        current.map((order) => (order.id === data.order.id ? data.order : order))
      );

      if (selectedOrderId === data.order.id) {
        setSelectedOrder(data.order);
      }

      await refreshSelectedOrder(orderId);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update the order."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }

  return (
    <main className="admin-shell">
      <section className="admin-header-card">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="admin-title">Orders</h1>
          <p className="admin-subtitle">Manage incoming Biteva orders.</p>
        </div>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <span>Total orders</span>
            <strong>{totalCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Current view</span>
            <strong>{activeFiltersLabel}</strong>
          </div>
        </div>
      </section>

      <InventoryPanel />

      <section className="admin-toolbar-card">
        <form className="admin-toolbar" onSubmit={handleSearchSubmit}>
          <label className="admin-control admin-control--search">
            <span>Search</span>
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Order number, name, email, city"
            />
          </label>

          <label className="admin-control">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "ALL" | OrderStatus);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All" : formatStatusLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="submit-button admin-search-button">
            Search
          </button>
        </form>
      </section>

      {error ? <p className="form-message form-message--error">{error}</p> : null}

      <section className="admin-grid">
        <div className="admin-list-card">
          <div className="admin-list-header">
            <h2>Order list</h2>
            <p>
              Page {page} of {pageCount}
            </p>
          </div>

          {loading ? (
            <p className="admin-empty-state">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="admin-empty-state">No orders found.</p>
          ) : (
            <div className="admin-order-list">
              {orders.map((order) => {
                const isSelected = selectedOrderId === order.id;

                return (
                  <button
                    key={order.id}
                    type="button"
                    className={`admin-order-row${isSelected ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setSelectedOrder(order);
                    }}
                  >
                    <div className="admin-order-row-top">
                      <strong>{order.orderNumber}</strong>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {order.deliveryMode === "gps" && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#D99E4F", background: "rgba(217,158,79,0.12)", padding: "2px 6px", borderRadius: "4px", lineHeight: 1.4 }}>GPS</span>
                        )}
                        <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                          {formatStatusLabel(order.status)}
                        </span>
                      </span>
                    </div>
                    <p>{order.customer.fullName}</p>
                    <p>{order.customer.email}</p>
                    <div className="admin-order-row-bottom">
                      <span>{formatDate(order.createdAt)}</span>
                      <strong>{formatEuro(order.totalAmountCents)}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="admin-pagination">
            <button
              type="button"
              className="admin-page-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              className="admin-page-button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page >= pageCount || loading}
            >
              Next
            </button>
          </div>
        </div>

        <div className="admin-detail-card">
          {!selectedOrder ? (
            <p className="admin-empty-state">Select an order to inspect it.</p>
          ) : (
            <>
              <div className="admin-detail-header">
                <div>
                  <p className="eyebrow">Selected order</p>
                  <h2>{selectedOrder.orderNumber}</h2>
                  <p>{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <span
                  className={`status-badge status-badge--${selectedOrder.status.toLowerCase()}`}
                >
                  {formatStatusLabel(selectedOrder.status)}
                </span>
              </div>

              <div className="admin-detail-section">
                <h3>Customer</h3>
                <p>{selectedOrder.customer.fullName}</p>
                <p>{selectedOrder.customer.email}</p>
                {selectedOrder.customer.phone ? <p>{selectedOrder.customer.phone}</p> : null}
              </div>

              <div className="admin-detail-section">
                <h3>Delivery</h3>
                {selectedOrder.deliveryMode === "gps" && selectedOrder.deliveryLat != null && selectedOrder.deliveryLng != null ? (
                  <>
                    <p style={{ fontSize: "12px", color: "#D99E4F", fontWeight: 600, marginBottom: "8px" }}>GPS Pin</p>
                    {/* OSM embed — works without any API key */}
                    <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", height: "200px" }}>
                      <iframe
                        title="Delivery location"
                        width="100%"
                        height="200"
                        style={{ border: 0, display: "block" }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedOrder.deliveryLng - 0.005},${selectedOrder.deliveryLat - 0.003},${selectedOrder.deliveryLng + 0.005},${selectedOrder.deliveryLat + 0.003}&layer=mapnik&marker=${selectedOrder.deliveryLat},${selectedOrder.deliveryLng}`}
                        loading="lazy"
                      />
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#888" }}>
                      {selectedOrder.deliveryLat.toFixed(6)}, {selectedOrder.deliveryLng.toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${selectedOrder.deliveryLat},${selectedOrder.deliveryLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", color: "#D99E4F", fontWeight: 600, textDecoration: "underline" }}
                    >
                      Open in Google Maps ↗
                    </a>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "12px", color: "#888", fontWeight: 600, marginBottom: "4px" }}>Address</p>
                    <p>{selectedOrder.shipping.addressLine1 ?? "—"}</p>
                    {selectedOrder.shipping.addressLine2 ? (
                      <p>{selectedOrder.shipping.addressLine2}</p>
                    ) : null}
                    <p>
                      {selectedOrder.shipping.postalCode ?? "—"} {selectedOrder.shipping.city ?? ""}
                    </p>
                    <p>{selectedOrder.shipping.country ?? "—"}</p>
                  </>
                )}
              </div>

              <div className="admin-detail-section">
                <h3>Items</h3>
                <div className="admin-items-list">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="admin-item-row">
                      <div>
                        <strong>{item.productName}</strong>
                        <p>Qty {item.quantity}</p>
                      </div>
                      <strong>{formatEuro(item.lineTotalCents)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Change status</h3>
                <div className="admin-status-actions">
                  {STATUS_OPTIONS.filter(
                    (option): option is OrderStatus => option !== "ALL"
                  ).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`admin-status-button${selectedOrder.status === option ? " is-current" : ""}`}
                      onClick={() => updateStatus(selectedOrder.id, option)}
                      disabled={updatingOrderId === selectedOrder.id}
                    >
                      {updatingOrderId === selectedOrder.id && selectedOrder.status !== option
                        ? "Updating..."
                        : formatStatusLabel(option)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
