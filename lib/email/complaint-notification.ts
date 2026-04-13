const CATEGORY_LABELS: Record<string, string> = {
  LATE_DELIVERY: "Late Delivery",
  WRONG_ORDER: "Wrong Order",
  QUALITY: "Quality Issue",
  OTHER: "Other",
};

type ComplaintNotification = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  category: string;
  subject: string;
  message: string;
  orderNumber: string | null;
  createdAt: Date;
};

export function buildComplaintNotificationEmail(
  complaint: ComplaintNotification,
  adminUrl: string,
): { subject: string; html: string } {
  const categoryLabel = CATEGORY_LABELS[complaint.category] ?? complaint.category;
  const subject = `New complaint received — ${categoryLabel}`;

  const orderRow = complaint.orderNumber
    ? `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;width:140px;">Order</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">${complaint.orderNumber}</td>
       </tr>`
    : "";

  const phoneRow = complaint.phone
    ? `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;width:140px;">Phone</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;">${complaint.phone}</td>
       </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
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
              <div style="font-size:11px;color:#525252;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Customer Complaint</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px;">

              <div style="background:#FEE2E2;border-left:4px solid #EF4444;padding:16px 20px;border-radius:8px;margin-bottom:28px;">
                <div style="font-size:16px;font-weight:700;margin-bottom:4px;">New Complaint Received</div>
                <div style="font-size:14px;color:#555;">Category: <strong>${categoryLabel}</strong></div>
              </div>

              <h2 style="font-size:16px;margin:0 0 12px;">Complaint Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <tbody>
                  <tr>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;width:140px;">From</td>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">${complaint.name}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Email</td>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;">${complaint.email}</td>
                  </tr>
                  ${phoneRow}
                  ${orderRow}
                  <tr>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Subject</td>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">${complaint.subject}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;">Message</td>
                    <td style="padding:10px 14px;font-size:14px;line-height:1.6;">${complaint.message.replace(/\n/g, "<br />")}</td>
                  </tr>
                </tbody>
              </table>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="${adminUrl}" style="display:inline-block;background:#D99E4F;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:99px;text-decoration:none;">
                  View in Admin Panel
                </a>
              </div>

              <div style="border-top:1px solid #eee;padding-top:16px;font-size:13px;color:#888;">
                Received on ${complaint.createdAt.toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
