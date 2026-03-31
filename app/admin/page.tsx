"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalAmountCents: number;
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
          throw new Error(data.error ?? "Could not load orders.");
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
      throw new Error(data.error ?? "Could not refresh the order.");
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
        throw new Error(data.error ?? "Could not update the order.");
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
                      <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                        {formatStatusLabel(order.status)}
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
                <h3>Shipping address</h3>
                <p>{selectedOrder.shipping.addressLine1 ?? "—"}</p>
                {selectedOrder.shipping.addressLine2 ? (
                  <p>{selectedOrder.shipping.addressLine2}</p>
                ) : null}
                <p>
                  {selectedOrder.shipping.postalCode ?? "—"} {selectedOrder.shipping.city ?? ""}
                </p>
                <p>{selectedOrder.shipping.country ?? "—"}</p>
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
