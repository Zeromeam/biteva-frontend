function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OrderSummary = {
  orderNumber: string;
  scheduledFor: Date;
  totalAmountCents: number;
  shippingFullName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingCity: string | null;
  deliveryMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  items: Array<{ quantity: number; product: { name: string } }>;
};

type BigDayAlert = {
  date: Date;
  orderCount: number;
  orders: Array<{
    orderNumber: string;
    scheduledFor: Date;
    totalAmountCents: number;
    items: Array<{ quantity: number; product: { name: string } }>;
  }>;
  adminUrl: string;
};

export function buildBigDayAlertEmail(
  alert: BigDayAlert,
): { subject: string; html: string } {
  const dateStr = alert.date.toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Aggregate items across all orders for the summary
  const itemCounts = new Map<string, number>();
  for (const order of alert.orders) {
    for (const item of order.items) {
      itemCounts.set(
        item.product.name,
        (itemCounts.get(item.product.name) ?? 0) + item.quantity,
      );
    }
  }
  const totalItems = [...itemCounts.values()].reduce((a, b) => a + b, 0);
  const topItems = [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const itemSummaryRows = topItems
    .map(
      ([name, qty]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;">${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:right;font-weight:700;">${qty}×</td>
    </tr>`,
    )
    .join("");

  const orderRows = alert.orders
    .map(
      (o) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;">${o.orderNumber}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;">${formatDateTime(o.scheduledFor)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatCents(o.totalAmountCents)}</td>
    </tr>`,
    )
    .join("");

  const subject = `⚠️ Busy day ahead — ${alert.orderCount} orders on ${dateStr}`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0c0c0c;border-radius:16px 16px 0 0;padding:32px 36px;">
              <div style="font-size:28px;font-weight:700;color:#D99E4F;letter-spacing:0.04em;font-style:italic;">Biteva</div>
              <div style="font-size:11px;color:#525252;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Kitchen Notification</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px;">

              <div style="background:#FFF3CD;border-left:4px solid #D99E4F;padding:16px 20px;border-radius:8px;margin-bottom:28px;">
                <div style="font-size:16px;font-weight:700;margin-bottom:4px;">Busy Day Ahead</div>
                <div style="font-size:14px;color:#555;">${dateStr} — ${alert.orderCount} orders scheduled</div>
              </div>

              <h2 style="font-size:16px;margin:0 0 12px;">Item Summary (${totalItems} total)</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;color:#fff;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                ${itemSummaryRows}
              </table>

              <h2 style="font-size:16px;margin:0 0 12px;">Scheduled Orders</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <thead>
                  <tr style="background:#f9f9f9;">
                    <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Order</th>
                    <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Time</th>
                    <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderRows}
                </tbody>
              </table>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="${alert.adminUrl}" style="display:inline-block;background:#D99E4F;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:99px;text-decoration:none;">
                  View in Admin Panel
                </a>
              </div>

              <div style="border-top:1px solid #eee;padding-top:16px;font-size:13px;color:#888;">
                Please acknowledge this in the admin panel to confirm you have seen it.
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f1ee;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;font-size:12px;color:#aaa;">
              Biteva Fine Dining · Wien, Österreich
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function buildReleaseNotificationEmail(
  order: OrderSummary,
  adminUrl: string,
): { subject: string; html: string } {
  const timeStr = formatDateTime(order.scheduledFor);
  const itemList = order.items
    .map((i) => `${i.quantity}× ${i.product.name}`)
    .join(", ");

  const subject = `Order ${order.orderNumber} is now active — delivery at ${order.scheduledFor.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#0c0c0c;border-radius:16px 16px 0 0;padding:32px 36px;">
            <div style="font-size:28px;font-weight:700;color:#D99E4F;letter-spacing:0.04em;font-style:italic;">Biteva</div>
            <div style="font-size:11px;color:#525252;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Kitchen Queue</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px;">
            <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px 20px;border-radius:8px;margin-bottom:24px;">
              <div style="font-size:16px;font-weight:700;">Order is now active</div>
              <div style="font-size:14px;color:#555;margin-top:4px;">Order <strong>${order.orderNumber}</strong> has entered the kitchen queue</div>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:4px;">Delivery Time</td></tr>
              <tr><td style="font-size:15px;font-weight:600;">${timeStr}</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:4px;">Customer</td></tr>
              <tr><td style="font-size:15px;">${order.shippingFullName ?? "—"} · ${order.shippingPhone ?? "—"}</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:4px;">Items</td></tr>
              <tr><td style="font-size:14px;">${itemList}</td></tr>
            </table>
            <div style="text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background:#D99E4F;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:99px;text-decoration:none;">Open in Admin Panel</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f1ee;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;font-size:12px;color:#aaa;">Biteva Fine Dining · Wien, Österreich</td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
