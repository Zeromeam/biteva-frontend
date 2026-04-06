function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type ReceiptOrder = {
  orderNumber: string;
  createdAt: Date;
  totalAmountCents: number;
  shippingFullName: string | null;
  shippingEmail: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  items: Array<{
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    product: { name: string };
  }>;
};

export function buildReceiptEmail(
  order: ReceiptOrder,
  receiptUrl: string,
): { subject: string; html: string } {
  const subject = `Your Biteva receipt — ${order.orderNumber}`;

  const addressParts = [
    order.shippingAddressLine1,
    order.shippingCity && order.shippingPostalCode
      ? `${order.shippingPostalCode} ${order.shippingCity}`
      : order.shippingCity ?? order.shippingPostalCode,
    order.shippingCountry,
  ].filter(Boolean);

  const addressHtml = addressParts.length > 0
    ? addressParts.map((p) => `<div>${p}</div>`).join("")
    : "<div>—</div>";

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;">${item.product.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;text-align:right;">${formatCents(item.unitPriceCents)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #2a2a2a;text-align:right;">${formatCents(item.lineTotalCents)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Biteva Receipt</title>
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
              <div style="font-size:11px;color:#525252;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Fine Dining</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px;">

              <h1 style="font-size:22px;font-weight:700;margin:0 0 4px;">Danke für deine Bestellung!</h1>
              <p style="font-size:14px;color:#666;margin:0 0 28px;">Deine Bestellung wurde erfolgreich aufgenommen.</p>

              <!-- Order meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:4px;">Bestellnummer</td>
                  <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:4px;text-align:right;">Datum</td>
                </tr>
                <tr>
                  <td style="font-size:15px;font-weight:600;">${order.orderNumber}</td>
                  <td style="font-size:15px;font-weight:600;text-align:right;">${order.createdAt.toLocaleDateString("de-AT")}</td>
                </tr>
              </table>

              <!-- Delivery address -->
              <div style="margin-bottom:28px;">
                <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Lieferadresse</div>
                <div style="font-size:14px;line-height:1.6;">
                  <div style="font-weight:600;">${order.shippingFullName ?? ""}</div>
                  ${addressHtml}
                  ${order.shippingPhone ? `<div>${order.shippingPhone}</div>` : ""}
                </div>
              </div>

              <!-- Items table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;margin-bottom:16px;">
                <thead>
                  <tr style="background:#f9f9f9;">
                    <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;">Artikel</th>
                    <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;">Menge</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;">Einzelpreis</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="font-size:15px;font-weight:700;padding:12px 14px;">Gesamtbetrag</td>
                  <td style="font-size:18px;font-weight:700;color:#D99E4F;text-align:right;padding:12px 14px;">${formatCents(order.totalAmountCents)}</td>
                </tr>
              </table>

              <!-- View receipt button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${receiptUrl}" style="display:inline-block;background:#D99E4F;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:99px;text-decoration:none;">
                  Beleg anzeigen
                </a>
              </div>

              <!-- VAT exemption note -->
              <div style="border-top:1px solid #eee;padding-top:20px;font-size:12px;color:#999;line-height:1.6;">
                Gemäß § 6 Abs. 1 Z 27 UStG wird keine Umsatzsteuer berechnet.
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
