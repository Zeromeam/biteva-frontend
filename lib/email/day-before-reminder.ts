function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type BigDayReminderAlert = {
  date: Date;
  orderCount: number;
  totalItems: number;
  orders: Array<{
    orderNumber: string;
    scheduledFor: Date;
    totalAmountCents: number;
    items: Array<{ quantity: number; product: { name: string } }>;
  }>;
  adminUrl: string;
  isEscalation?: boolean; // true = 20:00 reminder, false = 08:00 first alert
};

export function buildDayBeforeReminderEmail(
  alert: BigDayReminderAlert,
): { subject: string; html: string } {
  const dateStr = alert.date.toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const prefix = alert.isEscalation ? "⚠️ REMINDER: " : "";
  const subject = `${prefix}Busy day tomorrow — ${alert.orderCount} orders on ${dateStr}`;

  const escalationBanner = alert.isEscalation
    ? `<div style="background:#FFEBEE;border-left:4px solid #f44336;padding:16px 20px;border-radius:8px;margin-bottom:20px;">
        <div style="font-size:15px;font-weight:700;color:#c62828;">This has not been acknowledged yet</div>
        <div style="font-size:13px;color:#555;margin-top:4px;">Please log in to the admin panel and confirm you have seen tomorrow's orders.</div>
      </div>`
    : "";

  const orderRows = alert.orders
    .map((o) => {
      const time = o.scheduledFor.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
      const items = o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ");
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;">${o.orderNumber}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;">${time}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666;">${items}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatCents(o.totalAmountCents)}</td>
      </tr>`;
    })
    .join("");

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
            <div style="font-size:11px;color:#525252;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Day-Before Reminder</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px;">

            ${escalationBanner}

            <div style="background:#FFF3CD;border-left:4px solid #D99E4F;padding:16px 20px;border-radius:8px;margin-bottom:28px;">
              <div style="font-size:16px;font-weight:700;">Tomorrow is a busy day</div>
              <div style="font-size:14px;color:#555;margin-top:4px;">
                ${dateStr} — <strong>${alert.orderCount} orders</strong>, ${alert.totalItems} total items
              </div>
            </div>

            <h2 style="font-size:16px;margin:0 0 12px;">Order Schedule</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;margin-bottom:28px;">
              <thead>
                <tr style="background:#f9f9f9;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Order</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Time</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Items</th>
                  <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Total</th>
                </tr>
              </thead>
              <tbody>${orderRows}</tbody>
            </table>

            <div style="text-align:center;margin-bottom:20px;">
              <a href="${alert.adminUrl}" style="display:inline-block;background:#D99E4F;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:99px;text-decoration:none;">
                Acknowledge in Admin Panel
              </a>
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
